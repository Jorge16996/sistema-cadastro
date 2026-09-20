

/* =========================================================
   firebase-sync.js — Sincronização do contador via Firebase
   =========================================================
   ✏️ SUBSTITUI os valores abaixo pelo teu firebaseConfig real.
   Obtém em: console.firebase.google.com → Project settings
   ========================================================= */

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyA-xOW_GkQ_Ogkv_10I-PtCDtY9MoADfT4",
  authDomain: "comunidade-9371f.firebaseapp.com",
  databaseURL: "https://comunidade-9371f-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "comunidade-9371f",
  storageBucket: "comunidade-9371f.firebasestorage.app",
  messagingSenderId: "371525047411",
  appId: "1:371525047411:web:97c9680fef7e90a2414606",
  measurementId: "G-GMXGGBF2DQ"
};

let _fbDb = null;
let _fbLoadPromise = null;
let _fbReady = false;

/* Carrega SDK do Firebase (uma única vez) */
function fbLoad() {
  if (_fbLoadPromise) return _fbLoadPromise;

  _fbLoadPromise = new Promise((resolve, reject) => {
    // Se já está carregado
    if (window.firebase && window.firebase.apps && window.firebase.apps.length) {
      _fbDb = window.firebase.database();
      _fbReady = true;
      return resolve();
    }

    const s1 = document.createElement("script");
    s1.src = "https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js";
    s1.onload = () => {
      const s2 = document.createElement("script");
      s2.src = "https://www.gstatic.com/firebasejs/10.12.0/firebase-database-compat.js";
      s2.onload = () => {
        try {
          if (!window.firebase.apps.length) {
            window.firebase.initializeApp(FIREBASE_CONFIG);
          }
          _fbDb = window.firebase.database();
          _fbReady = true;
          console.info("✅ Firebase pronto.");
          resolve();
        } catch (err) {
          console.error("Firebase init falhou:", err);
          reject(err);
        }
      };
      s2.onerror = () => reject(new Error("Falha ao carregar firebase-database"));
      document.head.appendChild(s2);
    };
    s1.onerror = () => reject(new Error("Falha ao carregar firebase-app"));
    document.head.appendChild(s1);
  });

  return _fbLoadPromise;
}

/* ---------- CONTADOR ---------- */

/* Incrementa o contador em 1 */
async function fbIncrementar() {
  await fbLoad();
  const ref = _fbDb.ref("contador");
  const result = await ref.transaction((v) => (v || 0) + 1);
  return result.snapshot.val() || 0;
}

/* Decrementa o contador em 1 (mínimo 0) */
async function fbDecrementar() {
  await fbLoad();
  const ref = _fbDb.ref("contador");
  const result = await ref.transaction((v) => Math.max(0, (v || 0) - 1));
  return result.snapshot.val() || 0;
}

/* Lê o valor atual */
async function fbLerContador() {
  await fbLoad();
  const snap = await _fbDb.ref("contador").once("value");
  return snap.val() || 0;
}

/* Subscreve mudanças em tempo real */
async function fbSubscreverContador(callback) {
  await fbLoad();
  _fbDb.ref("contador").on("value", (snap) => {
    callback(snap.val() || 0);
  });
}

/* Define o contador manualmente */
async function fbResetarContador(valor = 0) {
  await fbLoad();
  await _fbDb.ref("contador").set(Number(valor) || 0);
  return Number(valor) || 0;
}

/* Sincroniza com o número real de alunos deste dispositivo */
async function fbSincronizarComLocal() {
  await fbLoad();
  const locais = (typeof getStudents === "function") ? getStudents().length : 0;
  await _fbDb.ref("contador").set(locais);
  console.info(`✅ Firebase: contador definido para ${locais} alunos.`);
  return locais;
}

/* ---------- LIMITE ---------- */

async function fbGravarLimite(limite) {
  await fbLoad();
  await _fbDb.ref("limite").set(Number(limite) || 70);
  return Number(limite) || 70;
}

async function fbLerLimite() {
  await fbLoad();
  const snap = await _fbDb.ref("limite").once("value");
  return snap.val() || 70;
}

async function fbSubscreverLimite(callback) {
  await fbLoad();
  _fbDb.ref("limite").on("value", (snap) => {
    callback(snap.val() || 70);
  });
}

/* ---------- RESET (usar com cuidado) ---------- */

/* Reset completo — zerar contador e limite */
async function fbReset() {
  await fbLoad();
  await _fbDb.ref("contador").set(0);
  await _fbDb.ref("limite").set(70);
  console.info("✅ Firebase resetado.");
}

/* ---------- EXPORTAR GLOBALMENTE ---------- */
window.fbIncrementar = fbIncrementar;
window.fbDecrementar = fbDecrementar;
window.fbLerContador = fbLerContador;
window.fbSubscreverContador = fbSubscreverContador;
window.fbResetarContador = fbResetarContador;
window.fbSincronizarComLocal = fbSincronizarComLocal;
window.fbGravarLimite = fbGravarLimite;
window.fbLerLimite = fbLerLimite;
window.fbSubscreverLimite = fbSubscreverLimite;
window.fbReset = fbReset;