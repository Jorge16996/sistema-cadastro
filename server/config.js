require('dotenv').config();

const required = (k) => {
  const v = process.env[k];
  if (!v) throw new Error(`Variável de ambiente em falta: ${k}`);
  return v;
};
const num = (k, fallback) => {
  const v = Number(process.env[k]);
  return Number.isFinite(v) ? v : fallback;
};

module.exports = {
  env: process.env.NODE_ENV || 'development',
  port: num('PORT', 3000),
  corsOrigin: process.env.CORS_ORIGIN || '*',
  apiKey: process.env.API_KEY || '',

  db: {
    host: process.env.DB_HOST || 'localhost',
    port: num('DB_PORT', 3306),
    database: process.env.DB_NAME || 'comunidade',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
    charset: process.env.DB_CHARSET || 'utf8mb4',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    timezone: 'Z'
  },

  wa: {
    provider: process.env.WA_PROVIDER || 'callmebot',
    ativo: process.env.WA_ATIVO !== 'false',
    timeout: num('WA_TIMEOUT', 15000),
    retries: num('WA_RETRIES', 2),
    delayEntreEnvios: num('WA_DELAY_ENTRE_ENVIOS', 1500),
    logAtivo: process.env.WA_LOG_ATIVO !== 'false'
  },

  callmebot: {
    ceoKey:    process.env.CALLMEBOT_CEO_KEY || '',
    subceoKey: process.env.CALLMEBOT_SUBCEO_KEY || ''
  },
  ultramsg: {
    instance: process.env.ULTRAMSG_INSTANCE || '',
    token:    process.env.ULTRAMSG_TOKEN || ''
  },
  twilio: {
    sid:   process.env.TWILIO_SID || '',
    token: process.env.TWILIO_TOKEN || '',
    from:  process.env.TWILIO_FROM || ''
  },
  meta: {
    phoneId:    process.env.META_PHONE_ID || '',
    token:      process.env.META_TOKEN || '',
    apiVersion: process.env.META_API_VERSION || 'v18.0'
  },

  dest: {
    ceo: {
      nome:   process.env.DEST_CEO_NOME || 'CEO',
      cargo:  process.env.DEST_CEO_CARGO || 'CEO',
      numero: process.env.DEST_CEO_NUMERO || '',
      email:  process.env.DEST_CEO_EMAIL || ''
    },
    subceo: {
      nome:   process.env.DEST_SUBCEO_NOME || 'Sub-CEO',
      cargo:  process.env.DEST_SUBCEO_CARGO || 'Sub-CEO',
      numero: process.env.DEST_SUBCEO_NUMERO || '',
      email:  process.env.DEST_SUBCEO_EMAIL || ''
    },
    grupo: {
      id:   process.env.DEST_GRUPO_ID || '',
      nome: process.env.DEST_GRUPO_NOME || 'Grupo'
    }
  }
};