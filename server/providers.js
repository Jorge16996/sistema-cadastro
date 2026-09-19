const cfg = require('./config');
const { registar, atualizar } = require('./logger');

/* ---------- fetch com timeout ---------- */
async function fetchT(url, options = {}, timeoutMs = 15000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

const soDigitos = (s) => String(s || '').replace(/\D/g, '');

/* =========================================================
   CALLMEBOT
   ========================================================= */
async function enviarCallMeBot(numero, mensagem, apiKey) {
  if (!apiKey) return { ok: false, erro: 'CallMeBot key em falta.' };

  const url = 'https://api.callmebot.com/whatsapp.php?' + new URLSearchParams({
    phone: soDigitos(numero),
    text: mensagem,
    apikey: apiKey
  });

  try {
    const r = await fetchT(url);
    const corpo = await r.text();
    const ok = r.ok && !/error/i.test(corpo);
    return {
      ok,
      http_status: r.status,
      corpo,
      erro: ok ? null : 'CallMeBot: resposta inesperada'
    };
  } catch (err) {
    return { ok: false, erro: 'fetch: ' + err.message };
  }
}

/* =========================================================
   ULTRAMSG
   ========================================================= */
async function enviarUltraMsg(numero, mensagem) {
  const { instance, token } = cfg.ultramsg;
  if (!instance || !token) return { ok: false, erro: 'UltraMsg: credenciais em falta.' };

  const url = `https://api.ultramsg.com/${instance}/messages/chat`;
  const body = new URLSearchParams({
    token,
    to: numero.includes('@g.us') ? numero : soDigitos(numero),
    body: mensagem
  });

  try {
    const r = await fetchT(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString()
    });
    const texto = await r.text();
    let json = {};
    try { json = JSON.parse(texto); } catch {}
    const ok = r.ok && (json.sent !== false) && !json.error;
    return {
      ok,
      http_status: r.status,
      corpo: texto,
      erro: ok ? null : (json.error || 'UltraMsg: falha')
    };
  } catch (err) {
    return { ok: false, erro: 'fetch: ' + err.message };
  }
}

/* =========================================================
   TWILIO
   ========================================================= */
async function enviarTwilio(numero, mensagem) {
  const { sid, token, from } = cfg.twilio;
  if (!sid || !token || !from) return { ok: false, erro: 'Twilio: credenciais em falta.' };

  const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;
  const auth = Buffer.from(`${sid}:${token}`).toString('base64');
  const to = `whatsapp:+${soDigitos(numero)}`;
  const fromFmt = from.startsWith('whatsapp:') ? from : `whatsapp:${from}`;

  const body = new URLSearchParams({ From: fromFmt, To: to, Body: mensagem });

  try {
    const r = await fetchT(url, {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + auth,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: body.toString()
    });
    const texto = await r.text();
    let json = {};
    try { json = JSON.parse(texto); } catch {}
    const ok = r.ok && !json.code;
    return {
      ok,
      http_status: r.status,
      corpo: texto,
      erro: ok ? null : (json.message || 'Twilio: falha')
    };
  } catch (err) {
    return { ok: false, erro: 'fetch: ' + err.message };
  }
}

/* =========================================================
   META CLOUD API
   ========================================================= */
async function enviarMeta(numero, mensagem) {
  const { phoneId, token, apiVersion } = cfg.meta;
  if (!phoneId || !token) return { ok: false, erro: 'Meta: credenciais em falta.' };

  const url = `https://graph.facebook.com/${apiVersion}/${phoneId}/messages`;
  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: soDigitos(numero),
    type: 'text',
    text: { preview_url: false, body: mensagem }
  };

  try {
    const r = await fetchT(url, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    const texto = await r.text();
    let json = {};
    try { json = JSON.parse(texto); } catch {}
    const ok = r.ok && Array.isArray(json.messages);
    return {
      ok,
      http_status: r.status,
      corpo: texto,
      erro: ok ? null : (json.error?.message || 'Meta: falha')
    };
  } catch (err) {
    return { ok: false, erro: 'fetch: ' + err.message };
  }
}

/* =========================================================
   FACADE — escolhe o provider e envia com retry + log
   ========================================================= */
function despacharProvider(tipoDestinatario) {
  switch (cfg.wa.provider) {
    case 'callmebot': {
      const key = tipoDestinatario === 'ceo'    ? cfg.callmebot.ceoKey
                : tipoDestinatario === 'subceo' ? cfg.callmebot.subceoKey
                : '';
      return (numero, msg) => enviarCallMeBot(numero, msg, key);
    }
    case 'ultramsg': return enviarUltraMsg;
    case 'twilio':   return enviarTwilio;
    case 'meta':     return enviarMeta;
    default:
      throw new Error(`WA_PROVIDER inválido: ${cfg.wa.provider}`);
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function enviar(numero, mensagem, contexto = {}) {
  const {
    aluno_id, aluno_nome, dest_nome, dest_tipo = 'outro'
  } = contexto;

  const provider = cfg.wa.provider;
  const sendFn = despacharProvider(dest_tipo);

  const logId = await registar({
    aluno_id,
    aluno_nome,
    dest_nome,
    dest_num: numero,
    dest_tipo,
    msg: mensagem,
    provider,
    estado: 'pendente',
    ip: contexto.ip
  });

  let ultimoErro = null;
  let ultimaResposta = null;
  let tentativas = 0;

  while (tentativas <= cfg.wa.retries) {
    tentativas++;
    try {
      const res = await sendFn(numero, mensagem);
      ultimaResposta = res;

      if (res.ok) {
        await atualizar(logId, {
          estado: 'enviado',
          http_status: res.http_status ?? null,
          resposta_provider: String(res.corpo || '').slice(0, 2000),
          tentativas
        });
        return { ok: true, tentativas, http_status: res.http_status };
      }

      ultimoErro = res.erro || 'Erro desconhecido';
    } catch (err) {
      ultimoErro = err.message;
    }

    if (tentativas <= cfg.wa.retries) await sleep(400);
  }

  await atualizar(logId, {
    estado: 'falhou',
    http_status: ultimaResposta?.http_status ?? null,
    resposta_provider: String(ultimaResposta?.corpo || '').slice(0, 2000),
    erro: ultimoErro,
    tentativas
  });

  return { ok: false, erro: ultimoErro, tentativas };
}

module.exports = { enviar };