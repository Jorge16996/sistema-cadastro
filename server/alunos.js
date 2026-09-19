/* =========================================================
   alunos.js — CRUD de alunos via API REST
   ========================================================= */

const express = require('express');
const cfg = require('./config');
const { checkApiKey } = require('./auth');
const { getPool } = require('./db');

const router = express.Router();

/* Normalizar telefone — só dígitos */
const soDigitos = (s) => String(s || '').replace(/\D/g, '');

/* Mascarar telefone: 923000000 -> "923 000 000" */
function mascarar(d) {
  d = soDigitos(d).slice(0, 9);
  if (d.length <= 3) return d;
  if (d.length <= 6) return d.slice(0, 3) + ' ' + d.slice(3);
  return d.slice(0, 3) + ' ' + d.slice(3, 6) + ' ' + d.slice(6);
}

/* =========================================================
   GET /alunos — lista com busca, filtro, paginação, ordenação
   ========================================================= */
router.get('/alunos', checkApiKey, async (req, res) => {
  try {
    const p = getPool();
    const busca   = String(req.query.q || '').trim();
    const classe  = String(req.query.classe || '').trim();
    const pagina  = Math.max(1, Number(req.query.pagina) || 1);
    const porPag  = Math.min(500, Math.max(1, Number(req.query.por_pagina) || 10));
    const ordenar = ['nome', 'classe', 'criado_em'].includes(req.query.ordenar_por)
      ? req.query.ordenar_por : 'criado_em';
    const direcao = String(req.query.direcao).toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    let where = 'WHERE 1=1';
    const params = [];

    if (busca) {
      where += ' AND (nome LIKE ? OR telefone LIKE ? OR classe LIKE ?)';
      const like = `%${busca}%`;
      params.push(like, like, like);
    }
    if (classe) {
      where += ' AND classe = ?';
      params.push(classe);
    }

    const [cnt] = await p.query(`SELECT COUNT(*) AS total FROM alunos ${where}`, params);
    const total = cnt[0].total;

    const offset = (pagina - 1) * porPag;
    const [rows] = await p.query(
      `SELECT id, nome, telefone, data_nascimento, sexo, classe, curso,
              endereco, encarregado, telefone_encarregado, criado_em
       FROM alunos ${where}
       ORDER BY ${ordenar} ${direcao}
       LIMIT ? OFFSET ?`,
      [...params, porPag, offset]
    );

    res.json({
      ok: true,
      total,
      pagina,
      por_pagina: porPag,
      total_paginas: Math.max(1, Math.ceil(total / porPag)),
      alunos: rows
    });
  } catch (err) {
    console.error('[alunos/listar]', err);
    res.status(500).json({
      ok: false,
      erro: cfg.env === 'development' ? err.message : 'Erro ao listar.'
    });
  }
});

/* =========================================================
   GET /alunos/contagem — total de alunos
   ========================================================= */
router.get('/alunos/contagem', checkApiKey, async (_req, res) => {
  try {
    const [r] = await getPool().query('SELECT COUNT(*) AS total FROM alunos');
    res.json({ ok: true, total: r[0].total });
  } catch (err) {
    console.error('[alunos/contagem]', err);
    res.status(500).json({ ok: false, erro: 'Erro ao contar.' });
  }
});

/* =========================================================
   GET /alunos/classes — classes distintas (para o filtro)
   ========================================================= */
router.get('/alunos/classes', checkApiKey, async (_req, res) => {
  try {
    const [rows] = await getPool().query(
      `SELECT DISTINCT classe FROM alunos
       WHERE classe IS NOT NULL AND classe <> ''
       ORDER BY classe ASC`
    );
    res.json({ ok: true, classes: rows.map(r => r.classe) });
  } catch (err) {
    console.error('[alunos/classes]', err);
    res.status(500).json({ ok: false, erro: 'Erro.' });
  }
});

/* =========================================================
   GET /alunos/:id — obter um aluno
   ========================================================= */
router.get('/alunos/:id', checkApiKey, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1)
      return res.status(400).json({ ok: false, erro: 'ID inválido.' });

    const [rows] = await getPool().query(
      `SELECT id, nome, telefone, data_nascimento, sexo, classe, curso,
              endereco, encarregado, telefone_encarregado, criado_em
       FROM alunos WHERE id = ? LIMIT 1`,
      [id]
    );

    if (!rows.length)
      return res.status(404).json({ ok: false, erro: 'Aluno não encontrado.' });

    res.json({ ok: true, aluno: rows[0] });
  } catch (err) {
    console.error('[alunos/obter]', err);
    res.status(500).json({ ok: false, erro: 'Erro.' });
  }
});

/* =========================================================
   POST /alunos — criar novo aluno
   ========================================================= */
router.post('/alunos', checkApiKey, async (req, res) => {
  const b = req.body || {};
  const nome     = String(b.nome || '').trim();
  const telefone = mascarar(b.telefone);
  const classe   = String(b.classe || '').trim();

  if (nome.length < 3)
    return res.status(400).json({ ok: false, erro: 'Nome muito curto (mín. 3 caracteres).' });
  if (soDigitos(telefone).length < 9)
    return res.status(400).json({ ok: false, erro: 'Telefone inválido (9 dígitos).' });
  if (!classe)
    return res.status(400).json({ ok: false, erro: 'Classe obrigatória.' });

  /* Validação de data */
  if (b.data_nascimento) {
    const d = new Date(b.data_nascimento);
    if (isNaN(d.getTime()) || d > new Date())
      return res.status(400).json({ ok: false, erro: 'Data de nascimento inválida.' });
  }

  try {
    const p = getPool();

    /* Telefone duplicado? */
    const [dup] = await p.query(
      `SELECT id FROM alunos
       WHERE REPLACE(REPLACE(telefone,' ',''),'-','') = ?
       LIMIT 1`,
      [soDigitos(telefone)]
    );
    if (dup.length)
      return res.status(409).json({ ok: false, erro: 'Este telefone já possui cadastro.' });

    /* Limite */
    const [cfgRows] = await p.query('SELECT limite_cadastros FROM configuracoes LIMIT 1');
    const limite = cfgRows[0]?.limite_cadastros ?? 70;
    const [cnt] = await p.query('SELECT COUNT(*) AS total FROM alunos');
    if (cnt[0].total >= limite)
      return res.status(403).json({ ok: false, erro: 'Limite de cadastros atingido.' });

    const [r] = await p.execute(
      `INSERT INTO alunos
       (nome, telefone, data_nascimento, sexo, classe, curso, endereco,
        encarregado, telefone_encarregado)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        nome,
        telefone,
        b.data_nascimento || null,
        b.sexo || null,
        classe,
        b.curso || null,
        b.endereco || null,
        b.encarregado || null,
        b.telefone_encarregado ? mascarar(b.telefone_encarregado) : null
      ]
    );

    /* Buscar o registo criado (para ter criado_em e formato final) */
    const [novo] = await p.query(
      `SELECT id, nome, telefone, data_nascimento, sexo, classe, curso,
              endereco, encarregado, telefone_encarregado, criado_em
       FROM alunos WHERE id = ?`,
      [r.insertId]
    );

    res.status(201).json({
      ok: true,
      id: r.insertId,
      numero: String(cnt[0].total + 1).padStart(3, '0'),
      aluno: novo[0]
    });
  } catch (err) {
    console.error('[alunos/criar]', err);
    res.status(500).json({
      ok: false,
      erro: cfg.env === 'development' ? err.message : 'Erro ao criar.'
    });
  }
});

/* =========================================================
   DELETE /alunos/:id
   ========================================================= */
router.delete('/alunos/:id', checkApiKey, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1)
      return res.status(400).json({ ok: false, erro: 'ID inválido.' });

    const [r] = await getPool().execute('DELETE FROM alunos WHERE id = ?', [id]);
    if (r.affectedRows === 0)
      return res.status(404).json({ ok: false, erro: 'Aluno não encontrado.' });

    res.json({ ok: true });
  } catch (err) {
    console.error('[alunos/eliminar]', err);
    res.status(500).json({ ok: false, erro: 'Erro ao eliminar.' });
  }
});

/* =========================================================
   GET /limite e POST /limite
   ========================================================= */
router.get('/limite', checkApiKey, async (_req, res) => {
  try {
    const [r] = await getPool().query('SELECT limite_cadastros FROM configuracoes LIMIT 1');
    res.json({ ok: true, limite: r[0]?.limite_cadastros ?? 70 });
  } catch (err) {
    console.error('[limite/obter]', err);
    res.status(500).json({ ok: false, erro: 'Erro.' });
  }
});

router.post('/limite', checkApiKey, async (req, res) => {
  const n = Number(req.body?.limite);
  if (!Number.isInteger(n) || n < 1 || n > 100000)
    return res.status(400).json({ ok: false, erro: 'Limite inválido (1–100000).' });

  try {
    const p = getPool();
    const [cnt] = await p.query('SELECT COUNT(*) AS total FROM alunos');
    if (n < cnt[0].total)
      return res.status(400).json({
        ok: false,
        erro: `Limite inferior ao total atual (${cnt[0].total}).`
      });

    const [existe] = await p.query('SELECT id FROM configuracoes LIMIT 1');
    if (existe.length) {
      await p.execute('UPDATE configuracoes SET limite_cadastros = ? WHERE id = ?',
        [n, existe[0].id]);
    } else {
      await p.execute('INSERT INTO configuracoes (limite_cadastros) VALUES (?)', [n]);
    }
    res.json({ ok: true, limite: n });
  } catch (err) {
    console.error('[limite/gravar]', err);
    res.status(500).json({ ok: false, erro: 'Erro.' });
  }
});

module.exports = router;