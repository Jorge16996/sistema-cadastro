const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const qrcode = require('qrcode-terminal');
const path = require('path');

let sock = null;
let ready = false;
const fila = [];
const AUTH_DIR = path.join(__dirname, '..', '.baileys-auth');

async function iniciar() {
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);

  sock = makeWASocket({
    auth: state,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: false
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      console.log('\n📱 Escaneia o QR com o WhatsApp:\n');
      qrcode.generate(qr, { small: true });
    }
    if (connection === 'open') {
      ready = true;
      console.log('✅ Baileys pronto.');
      while (fila.length) {
        const job = fila.shift();
        job();
      }
    }
    if (connection === 'close') {
      ready = false;
      const code = lastDisconnect?.error?.output?.statusCode;
      const reconectar = code !== DisconnectReason.loggedOut;
      console.log('🔌 Ligação fechada. Reconectar?', reconectar);
      if (reconectar) setTimeout(iniciar, 3000);
    }
  });
}

async function enviarBaileys(numero, mensagem) {
  if (!ready) {
    await new Promise((resolve) => fila.push(resolve));
  }
  try {
    const jid = `${numero.replace(/\D/g, '')}@s.whatsapp.net`;
    const r = await sock.sendMessage(jid, { text: mensagem });
    return { ok: true, http_status: 200, corpo: JSON.stringify(r?.key || {}) };
  } catch (err) {
    return { ok: false, erro: 'Baileys: ' + err.message };
  }
}

module.exports = { iniciar, enviarBaileys };