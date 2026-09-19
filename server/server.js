const express = require('express');
const cors = require('cors');
const cfg = require('./src/config');
const routes = require('./src/routes');
const { testarConexao } = require('./src/db');

const app = express();

/* ---------- CORS — deve vir PRIMEIRO ---------- */
const corsOptions = {
  origin: true,               // aceita qualquer origem (reflete a que pediu)
  credentials: false,         // não usamos cookies
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'X-API-Key', 'Authorization'],
  exposedHeaders: ['Content-Length', 'X-Request-Id'],
  maxAge: 86400               // cache do preflight por 24h
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));   // responde automaticamente a OPTIONS

/* ---------- Body parsers ---------- */
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: false, limit: '100kb' }));

/* ---------- Trust proxy (Render põe-se atrás de proxy) ---------- */
app.set('trust proxy', 1);

/* ---------- Log simples ---------- */
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} (Origin: ${req.headers.origin || '-'})`);
  next();
});

/* ---------- Rotas ---------- */
app.use('/api', routes);

/* ---------- Rota raiz ---------- */
app.get('/', (_req, res) => {
  res.json({
    ok: true,
    nome: 'API Comunidade — WhatsApp',
    provider: cfg.wa.provider,
    versao: '1.0.0'
  });
});

/* ---------- 404 ---------- */
app.use((_req, res) => {
  res.status(404).json({ ok: false, erro: 'Endpoint não encontrado.' });
});

/* ---------- Erros globais ---------- */
app.use((err, _req, res, _next) => {
  console.error('[Erro global]', err);
  res.status(500).json({
    ok: false,
    erro: cfg.env === 'development' ? err.message : 'Erro interno.'
  });
});

/* ---------- Arranque ---------- */
(async () => {
  try {
    await testarConexao();
    console.log('✅ Base de dados ligada.');
  } catch (err) {
    console.error('❌ Falha na base de dados:', err.message);
    console.error('   A API vai arrancar, mas os logs falharão.');
  }

  app.listen(cfg.port, () => {
    console.log(`\n🚀 API WhatsApp a correr em http://localhost:${cfg.port}`);
    console.log(`   Provider: ${cfg.wa.provider}`);
    console.log(`   Ambiente: ${cfg.env}\n`);
  });
})();