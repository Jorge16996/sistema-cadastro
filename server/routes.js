const alunosRoutes = require('./alunos');
const express = require('express');
const cfg = require('./config');
const { checkApiKey } = require('./auth');
const { testarConexao } = require('./db');
const { enviar } = require('./providers');
const { listar } = require('./logger');
const { buildMessage } = require('./message');

const router = express.Router();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* =========================================================
   HEALTH — público
   ========================================================= */
router.get('/whatsapp/health', async (req, res) => {
  const info = {
    ok: true,
    ambiente: cfg.env,
    provider: cfg.wa.provider,
    whatsapp_ativo: cfg.wa.ativo,
    node: process.version,
    basedados: false
  };
  try {
    await testarConexao();
    info.basedados = true;
  } catch (err) {
    info.basedados = false;
    info.bd_erro = cfg.env === 'development' ? err.message : 'indisponível';
  }
  res.json(info);
});

/* =========================================================
   ENVIAR — mensagem arbitrária
   ========================================================= */
router.post('/whatsapp/enviar', checkApiKey, async (req, res) => {
  const numero = String(req.body.numero || '').trim();
  const mensagem = String(req.body.mensagem || '').trim();

  if (!/^\d{9,15}$/.test(numero.replace(/\D/g, ''))) {
    return res.status(400).json({ ok: false, erro: 'Número inválido (9–15 dígitos).' });
  }
  if (!mensagem || mensagem.length > 2000) {
    return res.status(400).json({ ok: false, erro: 'Mensagem vazia ou > 2000 caracteres.' });
  }
  if (!cfg.wa.ativo) {
    return res.status(503).json({ ok: false, erro: 'Envio de WhatsApp desativado.' });
  }

  try {
    const r = await enviar(numero, mensagem, {
      dest_nome: req.body.dest_nome,
      dest_tipo: req.body.dest_tipo || 'outro',
      aluno_id: req.body.aluno_id,
      aluno_nome: req.body.aluno_nome,
      ip: req.ip
    });
    res.status(r.ok ? 200 : 502).json(r);
  } catch (err) {
    console.error('[enviar]', err);
    res.status(500).json({
      ok: false,
      erro: cfg.env === 'development' ? err.message : 'Erro interno.'
    });
  }
});

/* =========================================================
   NOTIFICAR ALUNO — endpoint principal
   ========================================================= */
router.post('/whatsapp/notificar-aluno', checkApiKey, async (req, res) => {
  const b = req.body || {};

  const aluno = {
    id: b.aluno_id || '',
    nome: String(b.nome || '').trim(),
    telefone: String(b.telefone || '').trim(),
    classe: String(b.classe || '').trim(),
    curso: String(b.curso || '').trim(),
    endereco: String(b.endereco || '').trim(),
    encarregado: String(b.encarregado || '').trim(),
    telefone_encarregado: String(b.telefone_encarregado || '').trim(),
    criado_em: b.criado_em || new Date().toISOString()
  };
  const numeroCadastro = String(b.numero_cadastro || '');

  if (aluno.nome.length < 3) {
    return res.status(400).json({ ok: false, erro: 'Nome do aluno inválido.' });
  }
  if (!/^\d{9,15}$/.test(aluno.telefone.replace(/\D/g, ''))) {
    return res.status(400).json({ ok: false, erro: 'Telefone do aluno inválido.' });
  }
  if (!cfg.wa.ativo) {
    return res.status(503).json({ ok: false, erro: 'Envio de WhatsApp desativado.' });
  }

  const mensagem = buildMessage(aluno, numeroCadastro);

  const destinatarios = [
    { tipo: 'ceo',    nome: cfg.dest.ceo.nome,    numero: cfg.dest.ceo.numero },
    { tipo: 'subceo', nome: cfg.dest.subceo.nome, numero: cfg.dest.subceo.numero }
  ].filter((d) => d.numero);

  if (!destinatarios.length) {
    return res.status(500).json({ ok: false, erro: 'Nenhum destinatário configurado.' });
  }

  const resultados = [];

  for (let i = 0; i < destinatarios.length; i++) {
    const d = destinatarios[i];
    try {
      const r = await enviar(d.numero, mensagem, {
        aluno_id: aluno.id,
        aluno_nome: aluno.nome,
        dest_nome: d.nome,
        dest_tipo: d.tipo,
        ip: req.ip
      });
      resultados.push({
        destinatario: d.nome,
        tipo: d.tipo,
        ok: r.ok,
        erro: r.erro || null,
        tentativas: r.tentativas || 1
      });
    } catch (err) {
      console.error('[notificar]', err);
      resultados.push({
        destinatario: d.nome,
        tipo: d.tipo,
        ok: false,
        erro: cfg.env === 'development' ? err.message : 'erro interno'
      });
    }

    if (i < destinatarios.length - 1 && cfg.wa.delayEntreEnvios > 0) {
      await sleep(cfg.wa.delayEntreEnvios);
    }
  }

  const enviados = resultados.filter((r) => r.ok).length;
  const falhados = resultados.length - enviados;

  res.json({
    ok: enviados > 0,
    enviados,
    falhados,
    provider: cfg.wa.provider,
    resultados
  });
});

/* =========================================================
   LOG — listar
   ========================================================= */
router.get('/whatsapp/log-listar', checkApiKey, async (req, res) => {
  try {
    const rows = await listar({
      limite: req.query.limite || 100,
      estado: req.query.estado || '',
      aluno: req.query.aluno || ''
    });
    res.json({ ok: true, total: rows.length, mensagens: rows });
  } catch (err) {
    console.error('[log-listar]', err);
    res.status(500).json({
      ok: false,
      erro: cfg.env === 'development' ? err.message : 'Erro ao consultar log.'
    });
  }
});

router.use(alunosRoutes);
module.exports = router;