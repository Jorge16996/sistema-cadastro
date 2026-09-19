const { getPool } = require('./db');
const { wa } = require('./config');

async function registar(entrada) {
  if (!wa.logAtivo) return null;
  try {
    const p = getPool();
    const [r] = await p.execute(
      `INSERT INTO whatsapp_mensagens
         (aluno_id, aluno_nome, destinatario_nome, destinatario_numero,
          destinatario_tipo, mensagem, provider, estado, ip)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        entrada.aluno_id || null,
        entrada.aluno_nome || null,
        entrada.dest_nome || null,
        entrada.dest_num || '',
        entrada.dest_tipo || 'outro',
        entrada.msg || '',
        entrada.provider || 'desconhecido',
        entrada.estado || 'pendente',
        entrada.ip || null
      ]
    );
    return r.insertId;
  } catch (err) {
    console.error('[WA Logger] INSERT falhou:', err.message);
    return null;
  }
}

async function atualizar(id, dados) {
  if (!id || !wa.logAtivo) return;
  const permitidos = ['estado', 'http_status', 'resposta_provider', 'erro', 'tentativas'];
  const campos = [];
  const valores = [];

  for (const c of permitidos) {
    if (Object.prototype.hasOwnProperty.call(dados, c)) {
      campos.push(`${c} = ?`);
      valores.push(dados[c]);
    }
  }
  if (!campos.length) return;

  try {
    valores.push(id);
    await getPool().execute(
      `UPDATE whatsapp_mensagens SET ${campos.join(', ')} WHERE id = ?`,
      valores
    );
  } catch (err) {
    console.error('[WA Logger] UPDATE falhou:', err.message);
  }
}

async function listar({ limite = 100, estado = '', aluno = '' } = {}) {
  const p = getPool();
  let sql = `SELECT id, aluno_id, aluno_nome, destinatario_nome, destinatario_numero,
                    destinatario_tipo, provider, estado, http_status, erro,
                    tentativas, criado_em
             FROM whatsapp_mensagens WHERE 1=1`;
  const params = [];

  if (estado) { sql += ' AND estado = ?'; params.push(estado); }
  if (aluno)  { sql += ' AND aluno_nome LIKE ?'; params.push(`%${aluno}%`); }
  sql += ' ORDER BY criado_em DESC LIMIT ?';
  params.push(Math.max(1, Math.min(500, Number(limite) || 100)));

  const [rows] = await p.query(sql, params);
  return rows;
}

module.exports = { registar, atualizar, listar };