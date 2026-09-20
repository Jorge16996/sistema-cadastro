/* =========================================================
   notifications.js — envio via browser (CallMeBot + EmailJS)
   ========================================================= */

const NOTIF_LOG_KEY = "comunidade_notif_log_v1";
const NOTIF_MAX_LOG = 200;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------- LOG ---------- */
function getNotifLog() {
  try {
    const raw = localStorage.getItem(NOTIF_LOG_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}
function saveNotifLog(arr) {
  localStorage.setItem(NOTIF_LOG_KEY, JSON.stringify(arr.slice(-NOTIF_MAX_LOG)));
}
function genNotifId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return "n-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
function logNotif(entry) {
  const id = genNotifId();
  const arr = getNotifLog();
  arr.push({ id, criado_em: new Date().toISOString(), ...entry });
  saveNotifLog(arr);
  document.dispatchEvent(new CustomEvent("notif:updated"));
  return id;
}
function updateNotif(id, patch) {
  const arr = getNotifLog();
  const idx = arr.findIndex((n) => n.id === id);
  if (idx === -1) return;
  arr[idx] = { ...arr[idx], ...patch, atualizado_em: new Date().toISOString() };
  saveNotifLog(arr);
  document.dispatchEvent(new CustomEvent("notif:updated"));
}
function clearNotifLog() {
  localStorage.removeItem(NOTIF_LOG_KEY);
  document.dispatchEvent(new CustomEvent("notif:updated"));
}

/* ---------- MENSAGENS ---------- */
function buildMessageText(aluno, numero) {
  const linhas = [
    "🎓 *NOVO ALUNO CADASTRADO*",
    "",
    `👤 Nome: ${aluno.nome}`,
    `📞 Telefone: ${aluno.telefone}`,
    `🎓 Classe: ${aluno.classe}`
  ];
  if (aluno.curso) linhas.push(`📚 Curso: ${aluno.curso}`);
  if (aluno.endereco) linhas.push(`📍 Endereço: ${aluno.endereco}`);
  if (aluno.encarregado) linhas.push(`👨‍👩‍👦 Encarregado: ${aluno.encarregado}`);
  if (aluno.telefone_encarregado) linhas.push(`📞 Contacto encarregado: ${aluno.telefone_encarregado}`);

  if (aluno.pagamento_feito === "sim") {
    const v = Number(aluno.valor_pagamento);
    const vtxt = Number.isFinite(v) && v > 0
      ? v.toLocaleString("pt-AO") + " Kz"
      : "—";
    linhas.push("", `💰 Pagamento: *FEITO* — ${vtxt}`);
  } else {
    linhas.push("", "💰 Pagamento: *PENDENTE*");
  }

  linhas.push("");
  linhas.push(`🔢 Nº do cadastro: ${numero}`);
  linhas.push(`📅 ${new Date(aluno.criado_em).toLocaleString("pt-AO")}`);
  linhas.push("");
  linhas.push("— Sistema da Comunidade");
  return linhas.join("\n");
}

function buildEmailParams(aluno, numero, r) {
  const pago = aluno.pagamento_feito === "sim";
  const v = Number(aluno.valor_pagamento);
  const valorTxt = pago && Number.isFinite(v) && v > 0
    ? v.toLocaleString("pt-AO") + " Kz"
    : "—";

  return {
    to_name: r.nome, to_email: r.email, cargo: r.cargo,
    aluno_nome: aluno.nome, aluno_telefone: aluno.telefone,
    aluno_classe: aluno.classe, aluno_curso: aluno.curso || "—",
    aluno_endereco: aluno.endereco || "—",
    aluno_encarregado: aluno.encarregado || "—",
    aluno_telefone_encarregado: aluno.telefone_encarregado || "—",
    pagamento_feito: pago ? "Sim" : "Não",
    valor_pagamento: valorTxt,
    numero_cadastro: numero,
    data_cadastro: new Date(aluno.criado_em).toLocaleString("pt-AO"),
    mensagem: buildMessageText(aluno, numero)
  };
}

/* ---------- EMAILJS ---------- */
let _emailjsLoading = null;
function loadEmailJS() {
  if (window.emailjs) return Promise.resolve();
  if (_emailjsLoading) return _emailjsLoading;
  _emailjsLoading = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js";
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Falha ao carregar EmailJS"));
    document.head.appendChild(s);
  });
  return _emailjsLoading;
}

async function sendEmail(aluno, numero, r) {
  const cfg = window.COMUNIDADE_CONFIG?.emailjs || {};
  if (!cfg.publicKey || !cfg.serviceId || !cfg.templateId)
    return { ok: false, motivo: "EmailJS não configurado" };
  if (!r.email) return { ok: false, motivo: "Email em falta" };

  const logId = logNotif({
    aluno_id: aluno.id, aluno_nome: aluno.nome,
    canal: "email", destinatario: r.nome, contacto: r.email,
    estado: "pendente"
  });

  try {
    await loadEmailJS();
    window.emailjs.init({ publicKey: cfg.publicKey });
    const res = await window.emailjs.send(cfg.serviceId, cfg.templateId,
      buildEmailParams(aluno, numero, r));
    updateNotif(logId, { estado: "enviado", detalhe: `HTTP ${res?.status || 200}` });
    return { ok: true };
  } catch (err) {
    console.error("[Notif/Email]", err);
    updateNotif(logId, { estado: "falhou", detalhe: String(err?.text || err?.message || err) });
    return { ok: false, motivo: String(err?.message || err) };
  }
}

/* ---------- CALLMEBOT ---------- */
async function sendWhatsApp(aluno, numero, r) {
  if (!r.whatsapp || !r.callmebotKey)
    return { ok: false, motivo: "WhatsApp/CallMeBot não configurado" };

  const logId = logNotif({
    aluno_id: aluno.id, aluno_nome: aluno.nome,
    canal: "whatsapp", destinatario: r.nome, contacto: r.whatsapp,
    estado: "pendente"
  });

  const texto = buildMessageText(aluno, numero);
  const url = `https://api.callmebot.com/whatsapp.php`
    + `?phone=${encodeURIComponent(r.whatsapp)}`
    + `&text=${encodeURIComponent(texto)}`
    + `&apikey=${encodeURIComponent(r.callmebotKey)}`;

  try {
    await fetch(url, { mode: "no-cors" });
    updateNotif(logId, { estado: "enviado", detalhe: "aceite pelo servidor" });
    return { ok: true };
  } catch (err) {
    console.error("[Notif/WhatsApp]", err);
    updateNotif(logId, { estado: "falhou", detalhe: String(err?.message || err) });
    return { ok: false, motivo: String(err?.message || err) };
  }
}

/* ---------- FALLBACKS ---------- */
function buildWhatsAppLink(r, aluno, numero) {
  const phone = String(r.whatsapp || "").replace(/\D/g, "");
  const texto = buildMessageText(aluno, numero);
  return phone
    ? `https://wa.me/${phone}?text=${encodeURIComponent(texto)}`
    : `https://wa.me/?text=${encodeURIComponent(texto)}`;
}
function buildMailtoLink(r, aluno, numero) {
  const assunto = `Novo aluno cadastrado — ${aluno.nome}`;
  const corpo = buildMessageText(aluno, numero);
  return `mailto:${encodeURIComponent(r.email || "")}`
    + `?subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(corpo)}`;
}
function openWhatsAppManual(aluno, numero, quem) {
  const cfg = window.COMUNIDADE_CONFIG?.destinatarios || {};
  const r = quem === "subceo" ? cfg.subceo : cfg.ceo;
  if (!r) return;
  window.open(buildWhatsAppLink(r, aluno, numero), "_blank", "noopener");
}
function openEmailManual(aluno, numero, quem) {
  const cfg = window.COMUNIDADE_CONFIG?.destinatarios || {};
  const r = quem === "subceo" ? cfg.subceo : cfg.ceo;
  if (!r) return;
  window.location.href = buildMailtoLink(r, aluno, numero);
}

/* ---------- ORQUESTRADOR ---------- */
async function sendNewStudentNotifications(aluno, numero) {
  const cfg = window.COMUNIDADE_CONFIG;
  if (!cfg) return { enviados: 0, falhados: 0, resultados: [] };

  const alvos = [cfg.destinatarios?.ceo, cfg.destinatarios?.subceo].filter(Boolean);
  const resultados = [];

  for (const r of alvos) {
    if (cfg.ativo?.email) {
      resultados.push({ canal: "email", quem: r.nome, ...(await sendEmail(aluno, numero, r)) });
      await sleep(200);
    }
    if (cfg.ativo?.whatsapp) {
      resultados.push({ canal: "whatsapp", quem: r.nome, ...(await sendWhatsApp(aluno, numero, r)) });
      await sleep(1500);
    }
  }

  const enviados = resultados.filter(x => x.ok).length;
  const falhados = resultados.filter(x => !x.ok).length;
  return { enviados, falhados, resultados };
}

/* ---------- TOAST ---------- */
function showToast(msg, tipo = "info", dur = 3800) {
  let box = document.getElementById("toastBox");
  if (!box) {
    box = document.createElement("div");
    box.id = "toastBox";
    box.className = "toast-box";
    document.body.appendChild(box);
  }
  const t = document.createElement("div");
  t.className = "toast " + tipo;
  t.innerHTML = msg;
  box.appendChild(t);
  requestAnimationFrame(() => t.classList.add("visible"));
  setTimeout(() => {
    t.classList.remove("visible");
    setTimeout(() => t.remove(), 300);
  }, dur);
}

/* ---------- PAINEL ---------- */
function renderNotifPanel() {
  const list = document.getElementById("notifList");
  const cfgBox = document.getElementById("notifConfig");
  if (!list) return;

  if (cfgBox) {
    const cfg = window.COMUNIDADE_CONFIG || {};
    const emailOk = cfg.emailjs?.publicKey && cfg.emailjs?.serviceId && cfg.emailjs?.templateId;
    const waOk = cfg.destinatarios?.ceo?.callmebotKey || cfg.destinatarios?.subceo?.callmebotKey;
    cfgBox.innerHTML = `
      <div class="notif-cfg-item ${emailOk ? "on" : "off"}">
        <span class="dot"></span>
        E-mail (EmailJS): <strong>${emailOk ? "configurado" : "não configurado"}</strong>
      </div>
      <div class="notif-cfg-item ${waOk ? "on" : "off"}">
        <span class="dot"></span>
        WhatsApp (CallMeBot): <strong>${waOk ? "configurado" : "não configurado"}</strong>
      </div>
    `;
  }

  const log = getNotifLog().slice().reverse();
  if (!log.length) {
    list.innerHTML = `<p class="notif-empty">Sem notificações registadas.</p>`;
    return;
  }

  const icons = {
    email: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>`,
    whatsapp: `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M20.52 3.48A11.9 11.9 0 0 0 12.06 0C5.5 0 .16 5.34.16 11.9c0 2.1.55 4.15 1.6 5.96L0 24l6.3-1.65a11.9 11.9 0 0 0 5.76 1.47h.01c6.56 0 11.9-5.34 11.9-11.9 0-3.18-1.24-6.17-3.45-8.44z"/></svg>`
  };
  const estados = {
    enviado: { txt: "Enviado", cls: "ok" },
    falhou: { txt: "Falhou", cls: "fail" },
    pendente: { txt: "Pendente", cls: "wait" }
  };

  list.innerHTML = log.map((n) => {
    const est = estados[n.estado] || estados.pendente;
    const data = n.criado_em ? new Date(n.criado_em).toLocaleString("pt-AO") : "—";
    return `
      <div class="notif-item ${est.cls}">
        <div class="notif-channel">${icons[n.canal] || ""}</div>
        <div class="notif-info">
          <strong>${n.destinatario || "—"}</strong>
          <span class="notif-aluno">${n.aluno_nome || "—"}</span>
          <span class="notif-meta">${n.contacto || ""} • ${data}</span>
          ${n.detalhe ? `<span class="notif-detail">${n.detalhe}</span>` : ""}
        </div>
        <div class="notif-badge">${est.txt}</div>
      </div>
    `;
  }).join("");
}

document.addEventListener("notif:updated", () => {
  if (document.getElementById("notifList")) renderNotifPanel();
});

/* ---------- EXPORTAR ---------- */
window.sendNewStudentNotifications = sendNewStudentNotifications;
window.openWhatsAppManual = openWhatsAppManual;
window.openEmailManual    = openEmailManual;
window.buildWhatsAppLink  = buildWhatsAppLink;
window.buildMailtoLink    = buildMailtoLink;
window.buildMessageText   = buildMessageText;
window.getNotifLog        = getNotifLog;
window.clearNotifLog      = clearNotifLog;
window.renderNotifPanel   = renderNotifPanel;
window.showToast          = showToast;