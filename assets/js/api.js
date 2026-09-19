/* =========================================================
   api.js — Camada de acesso à API REST
   Substitui o localStorage por chamadas ao servidor.
   ========================================================= */

const API_URL = "https://comunidade-api.onrender.com/api"; // ← o teu URL real
const API_KEY = "TROCA_ESTA_CHAVE_POR_UMA_ALEATORIA_64_CARACTERES"; // igual ao .env do servidor

async function apiFetch(path, options = {}) {
  const r = await fetch(API_URL + path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': API_KEY,
      ...(options.headers || {})
    }
  });

  let data = {};
  try { data = await r.json(); } catch {}

  if (!r.ok) {
    const msg = data.erro || `HTTP ${r.status}`;
    const err = new Error(msg);
    err.status = r.status;
    throw err;
  }
  return data;
}

/* ---------- Alunos ---------- */
async function apiListarAlunos(params = {}) {
  const q = new URLSearchParams(params).toString();
  return apiFetch('/alunos' + (q ? '?' + q : ''));
}
async function apiContarAlunos() {
  return apiFetch('/alunos/contagem');
}
async function apiListarClasses() {
  return apiFetch('/alunos/classes');
}
async function apiObterAluno(id) {
  return apiFetch('/alunos/' + encodeURIComponent(id));
}
async function apiCriarAluno(aluno) {
  return apiFetch('/alunos', {
    method: 'POST',
    body: JSON.stringify(aluno)
  });
}
async function apiEliminarAluno(id) {
  return apiFetch('/alunos/' + encodeURIComponent(id), { method: 'DELETE' });
}

/* ---------- Limite ---------- */
async function apiObterLimite() {
  return apiFetch('/limite');
}
async function apiGuardarLimite(limite) {
  return apiFetch('/limite', {
    method: 'POST',
    body: JSON.stringify({ limite })
  });
}

/* ---------- Health ---------- */
async function apiHealth() {
  return apiFetch('/whatsapp/health');
}

/* Exportar globalmente */
window.apiFetch          = apiFetch;
window.apiListarAlunos   = apiListarAlunos;
window.apiContarAlunos   = apiContarAlunos;
window.apiListarClasses  = apiListarClasses;
window.apiObterAluno     = apiObterAluno;
window.apiCriarAluno     = apiCriarAluno;
window.apiEliminarAluno  = apiEliminarAluno;
window.apiObterLimite    = apiObterLimite;
window.apiGuardarLimite  = apiGuardarLimite;
window.apiHealth         = apiHealth;