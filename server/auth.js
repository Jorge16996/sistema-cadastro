const { apiKey } = require('./config');

function checkApiKey(req, res, next) {
  /* OPTIONS passa sempre — é preflight, não traz a chave */
  if (req.method === 'OPTIONS') return next();

  const received = req.headers['x-api-key'] || '';
  if (!apiKey || received !== apiKey) {
    return res.status(401).json({ ok: false, erro: 'Chave de API inválida.' });
  }
  next();
}

module.exports = { checkApiKey };