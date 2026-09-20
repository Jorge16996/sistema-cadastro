/* =========================================================
   app.js — Sistema de Cadastro de Alunos (v12)
   localStorage + pagamento + comprovativo WhatsApp
   + Firebase (contador em tempo real)
   + Netlify Forms (backup online)
   ========================================================= */

const KEY = "comunidade_alunos_v1";
const LIMIT_KEY = "comunidade_limite_v1";
const ADMIN_AUTH_KEY = "comunidade_admin_auth";
const DEFAULT_LIMIT = 70;
const MAX_LIMIT = 100000;
const MIN_IDADE = 3;
const MAX_IDADE = 120;
const NETLIFY_FORM_NAME = "cadastro-aluno";

/* =========================================================
   GUARDA ADMIN
   ========================================================= */
function normalizeAnswer(s) {
  return String(s ?? "").toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .trim().replace(/\s+/g, " ");
}
function isCorrectAdminAnswer(s) {
  const n = normalizeAnswer(s);
  return /\b(satoru|saturo)\b/.test(n) && /\bgojo\b/.test(n);
}
function askAdminQuestion() {
  const r = prompt("🔒 Acesso restrito\n\nQual é o personagem preferido do ADM?");
  if (r === null) return false;
  if (isCorrectAdminAnswer(r)) {
    try { sessionStorage.setItem(ADMIN_AUTH_KEY, "ok"); } catch {}
    return true;
  }
  alert("Resposta incorreta. Acesso negado.");
  return false;
}
function isAdminAuthorized() {
  try { return sessionStorage.getItem(ADMIN_AUTH_KEY) === "ok"; }
  catch { return false; }
}
(function guardAdminPage() {
  const path = location.pathname.toLowerCase();
  if (!path.endsWith("admin.html")) return;
  if (isAdminAuthorized()) return;
  if (askAdminQuestion()) return;
  location.replace("index.html");
})();

/* =========================================================
   ARMAZENAMENTO
   ========================================================= */
function getStudents() {
  try {
    const raw = localStorage.getItem(KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}
function saveStudents(a) { localStorage.setItem(KEY, JSON.stringify(a)); }
function getLimit() {
  const n = Number(localStorage.getItem(LIMIT_KEY));
  return Number.isInteger(n) && n > 0 ? n : DEFAULT_LIMIT;
}

/* =========================================================
   UTILITÁRIOS
   ========================================================= */
const normPhone = (t) => String(t ?? "").replace(/\D/g, "");
const normalize = (s) => String(s ?? "").toLowerCase()
  .normalize("NFD").replace(/[\u0300-\u036f]/g, "");

function genId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return "id-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
}
function esc(x = "") {
  return String(x).replace(/[&<>"']/g, (m) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[m]));
}
function maskPhone(v) {
  const d = normPhone(v).slice(0, 9);
  if (d.length <= 3) return d;
  if (d.length <= 6) return d.slice(0, 3) + " " + d.slice(3);
  return d.slice(0, 3) + " " + d.slice(3, 6) + " " + d.slice(6);
}
function formatDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d)) return "—";
  try { return d.toLocaleString("pt-AO", { dateStyle: "short", timeStyle: "short" }); }
  catch { return d.toLocaleString("pt-AO"); }
}
function formatarValor(v) {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return "—";
  try {
    return n.toLocaleString("pt-AO", { maximumFractionDigits: 2 }) + " Kz";
  } catch {
    return n + " Kz";
  }
}
function buildComprovativoWhatsAppLink(aluno, numero) {
  const cfg = window.COMUNIDADE_CONFIG?.destinatarios?.ceo || {};
  const phone = String(cfg.whatsapp || "244922661537").replace(/\D/g, "");

  const linhas = [
    "Olá Líder da Comunidade! 👋",
    "",
    "Acabei de fazer o meu cadastro e envio o meu comprovativo.",
    "",
    `👤 Nome: ${aluno.nome}`,
    `📞 Telefone: ${aluno.telefone}`,
    `🎓 Classe: ${aluno.classe}`
  ];

  if (aluno.pagamento_feito === "sim") {
    const v = Number(aluno.valor_pagamento);
    const vtxt = Number.isFinite(v) && v > 0
      ? v.toLocaleString("pt-AO") + " Kz"
      : "—";
    linhas.push("", `💰 Pagamento: FEITO — ${vtxt}`);
  } else {
    linhas.push("", "💰 Pagamento: PENDENTE");
  }

  linhas.push("", `🔢 Nº do cadastro: ${numero}`);
  linhas.push("");
  linhas.push("— Envio o comprovativo em anexo 📎");

  const texto = linhas.join("\n");
  return `https://wa.me/${phone}?text=${encodeURIComponent(texto)}`;
}
function debounce(fn, ms = 250) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}
function validateBirthdate(value) {
  if (!value) return true;
  const d = new Date(value);
  if (isNaN(d.getTime())) return false;
  const now = new Date();
  if (d > now) return false;
  const age = (now - d) / (365.25 * 24 * 3600 * 1000);
  return age >= MIN_IDADE && age <= MAX_IDADE;
}

/* =========================================================
   MIGRAÇÃO
   ========================================================= */
function migrate() {
  const a = getStudents();
  if (!a.length) return;
  const seen = new Set();
  let changed = false;
  for (const s of a) {
    if (typeof s.id !== "string" || !s.id || seen.has(s.id)) {
      s.id = genId(); changed = true;
    }
    seen.add(s.id);
    if (s.telefone && s.telefone !== maskPhone(s.telefone)) {
      s.telefone = maskPhone(s.telefone); changed = true;
    }
    if (s.telefone_encarregado && s.telefone_encarregado !== maskPhone(s.telefone_encarregado)) {
      s.telefone_encarregado = maskPhone(s.telefone_encarregado); changed = true;
    }
    if (typeof s.pagamento_feito === "undefined") {
      s.pagamento_feito = "nao";
      s.valor_pagamento = null;
      changed = true;
    }
  }
  if (changed) saveStudents(a);
}

/* =========================================================
   RENDER DOS NÚMEROS
   ========================================================= */
function renderStatsUI(total, limite) {
  const v = Math.max(0, limite - total);
  const lotado = v === 0;
  const quaseCheio = !lotado && v <= Math.max(1, Math.floor(limite * 0.10));

  [["total", total], ["dTotal", total]].forEach(([id, val]) => {
    const e = document.getElementById(id); if (e) e.textContent = val;
  });
  [["limite", limite], ["dLimit", limite]].forEach(([id, val]) => {
    const e = document.getElementById(id); if (e) e.textContent = val;
  });
  [["vagas", v], ["dAvailable", v]].forEach(([id, val]) => {
    const e = document.getElementById(id); if (e) e.textContent = val;
  });

  const bar = document.getElementById("vagasBar");
  if (bar) {
    const pct = limite > 0 ? Math.min(100, (total / limite) * 100) : 0;
    bar.style.width = pct + "%";
    bar.classList.toggle("warn", quaseCheio);
    bar.classList.toggle("full", lotado);
  }

  const alerta = document.getElementById("vagasAlerta");
  if (alerta) {
    if (lotado) {
      alerta.className = "vagas-alerta full";
      alerta.textContent = "🚫 Vagas esgotadas — novas inscrições estão bloqueadas.";
      alerta.hidden = false;
    } else if (quaseCheio) {
      alerta.className = "vagas-alerta warn";
      alerta.textContent = `⚠️ Restam apenas ${v} vaga${v === 1 ? "" : "s"}!`;
      alerta.hidden = false;
    } else {
      alerta.hidden = true;
    }
  }

  const vagaEl = document.getElementById("vagas");
  if (vagaEl) { vagaEl.classList.toggle("warn", quaseCheio); vagaEl.classList.toggle("full", lotado); }
  const vagaEl2 = document.getElementById("dAvailable");
  if (vagaEl2) { vagaEl2.classList.toggle("warn", quaseCheio); vagaEl2.classList.toggle("full", lotado); }

  const btnCadastro = document.getElementById("btnCadastro");
  if (btnCadastro) {
    if (lotado) {
      btnCadastro.classList.add("disabled");
      btnCadastro.setAttribute("aria-disabled", "true");
      btnCadastro.textContent = "Vagas esgotadas";
      btnCadastro.removeAttribute("href");
    } else {
      btnCadastro.classList.remove("disabled");
      btnCadastro.removeAttribute("aria-disabled");
      btnCadastro.innerHTML = "Cadastrar-se <b>→</b>";
      btnCadastro.setAttribute("href", "cadastro.html");
    }
  }
}

/* =========================================================
   ESTATÍSTICAS + VAGAS
   ========================================================= */
function refreshStats() {
  const n = getStudents().length;
  const l = getLimit();

  /* Render local imediato */
  renderStatsUI(n, l);

  /* 🔄 Firebase — subscreve UMA vez */
  if (typeof fbSubscreverContador === "function" && !refreshStats._fbSetup) {
    refreshStats._fbSetup = true;
    fbSubscreverContador((totalOnline) => {
      renderStatsUI(totalOnline, getLimit());
    }).catch((err) => console.warn("Firebase offline:", err.message));
  }

  /* 🔄 Firebase — subscreve limite UMA vez */
  if (typeof fbSubscreverLimite === "function" && !refreshStats._fbLimitSetup) {
    refreshStats._fbLimitSetup = true;
    fbSubscreverLimite((limiteOnline) => {
      localStorage.setItem(LIMIT_KEY, String(limiteOnline));
      const nl = document.getElementById("newLimit");
      if (nl) nl.value = limiteOnline;
    }).catch(() => {});
  }

  const nl = document.getElementById("newLimit");
  if (nl) { nl.value = l; nl.max = MAX_LIMIT; }
}

function saveLimit() {
  const input = document.getElementById("newLimit");
  const n = Number(input.value);
  if (!Number.isInteger(n) || n < 1 || n > MAX_LIMIT) {
    alert(`Informe um limite válido entre 1 e ${MAX_LIMIT}.`);
    return;
  }
  const total = getStudents().length;
  if (n < total) {
    alert(`Não é possível definir um limite inferior ao número atual de alunos (${total}).`);
    return;
  }
  localStorage.setItem(LIMIT_KEY, String(n));

  /* 🔄 Firebase: publica novo limite */
  if (typeof fbGravarLimite === "function") {
    fbGravarLimite(n).catch((err) => console.warn("Firebase (limite):", err.message));
  }

  refreshStats();
  renderStudents();
}

/* =========================================================
   ESTADO DA UI
   ========================================================= */
const ui = {
  busca: "",
  classe: "",
  pagina: 1,
  porPagina: 10,
  ordenarPor: "criado_em",
  direcao: "desc"
};

function filterStudents(all) {
  const q = normalize(ui.busca).trim();
  return all.map((s, idx) => ({ s, idx })).filter(({ s }) => {
    if (ui.classe && s.classe !== ui.classe) return false;
    if (!q) return true;
    return (
      normalize(s.nome).includes(q) ||
      normalize(s.telefone).includes(q) ||
      normalize(s.classe).includes(q)
    );
  });
}

function sortStudents(list) {
  const { ordenarPor, direcao } = ui;
  const mult = direcao === "asc" ? 1 : -1;
  return list.slice().sort((a, b) => {
    const va = a.s[ordenarPor] ?? "";
    const vb = b.s[ordenarPor] ?? "";
    if (ordenarPor === "criado_em") return (new Date(va) - new Date(vb)) * mult;
    return normalize(va).localeCompare(normalize(vb), "pt") * mult;
  });
}

function paginate(list) {
  const total = list.length;
  const pages = Math.max(1, Math.ceil(total / ui.porPagina));
  if (ui.pagina > pages) ui.pagina = pages;
  if (ui.pagina < 1) ui.pagina = 1;
  const start = (ui.pagina - 1) * ui.porPagina;
  const end = start + ui.porPagina;
  return { itens: list.slice(start, end), total, pages };
}

/* =========================================================
   TABELA
   ========================================================= */
function renderStudents() {
  const tbody = document.getElementById("students");
  if (!tbody) return;

  const all = getStudents();
  const filtered = sortStudents(filterStudents(all));
  const { itens, total, pages } = paginate(filtered);

  if (!itens.length) {
    const emptyMsg = all.length
      ? "Nenhum aluno corresponde à busca/filtro."
      : "Ainda não existem alunos cadastrados.";
    tbody.innerHTML = `<tr><td colspan="7" class="empty">${emptyMsg}</td></tr>`;
  } else {
    tbody.innerHTML = itens.map(({ s, idx }) => {
      const num = String(idx + 1).padStart(3, "0");
      const id = esc(s.id);
      const pago = s.pagamento_feito === "sim";
      const badge = pago
        ? `<span class="pay-badge pago">✓ ${esc(formatarValor(s.valor_pagamento))}</span>`
        : `<span class="pay-badge pendente">⏳ Pendente</span>`;
      return `<tr>
        <td data-label="Nº">${num}</td>
        <td data-label="Nome">${esc(s.nome)}</td>
        <td data-label="Telefone">${esc(s.telefone)}</td>
        <td data-label="Classe">${esc(s.classe)}</td>
        <td data-label="Data / Hora">${esc(formatDate(s.criado_em))}</td>
        <td data-label="Pagamento">${badge}</td>
        <td data-label="Ações">
          <div class="row-actions">
            <button class="notify" type="button" data-notify="${id}" title="Enviar notificação à equipa">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg>
              Notificar
            </button>
            <button class="delete" type="button" data-id="${id}">Eliminar</button>
          </div>
        </td>
      </tr>`;
    }).join("");
  }

  renderPagination(total, pages);
  renderHeaderArrows();
}

function renderHeaderArrows() {
  document.querySelectorAll("th.sortable").forEach((th) => {
    if (th.dataset.sort === ui.ordenarPor) th.dataset.dir = ui.direcao;
    else delete th.dataset.dir;
  });
}

function renderPagination(total, pages) {
  const wrap = document.getElementById("pagination");
  const info = document.getElementById("pagInfo");
  const nums = document.getElementById("pagNumbers");
  if (!wrap || !info || !nums) return;

  if (total === 0) { wrap.hidden = true; return; }
  wrap.hidden = false;

  const start = (ui.pagina - 1) * ui.porPagina + 1;
  const end = Math.min(total, ui.pagina * ui.porPagina);
  info.textContent = `Mostrando ${start}–${end} de ${total} aluno${total === 1 ? "" : "s"}`;

  const janela = 5;
  let ini = Math.max(1, ui.pagina - Math.floor(janela / 2));
  let fim = Math.min(pages, ini + janela - 1);
  if (fim - ini + 1 < janela) ini = Math.max(1, fim - janela + 1);

  nums.innerHTML = "";
  for (let p = ini; p <= fim; p++) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = p;
    b.dataset.page = p;
    if (p === ui.pagina) b.setAttribute("aria-current", "page");
    nums.appendChild(b);
  }

  const btnPrev = document.querySelector('[data-page="prev"]');
  const btnNext = document.querySelector('[data-page="next"]');
  const btnFirst = document.querySelector('[data-page="first"]');
  const btnLast  = document.querySelector('[data-page="last"]');
  if (btnPrev)  btnPrev.disabled  = ui.pagina === 1;
  if (btnFirst) btnFirst.disabled = ui.pagina === 1;
  if (btnNext)  btnNext.disabled  = ui.pagina === pages;
  if (btnLast)  btnLast.disabled  = ui.pagina === pages;
}

/* ---------- Eliminar ---------- */
function removeStudent(id) {
  if (!id) return;
  if (!confirm("Eliminar este cadastro? Esta ação não pode ser desfeita.")) return;
  const a = getStudents();
  const idx = a.findIndex((s) => s.id === id);
  if (idx === -1) { alert("Registo não encontrado."); renderStudents(); return; }
  a.splice(idx, 1);
  saveStudents(a);

  /* 🔄 Firebase: decrementa */
  if (typeof fbDecrementar === "function") {
    fbDecrementar().catch((err) => console.warn("Firebase:", err.message));
  }

  refreshStats();
  renderStudents();
}

/* =========================================================
   CSV
   ========================================================= */
function csvSafe(v) {
  let s = String(v ?? "");
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return `"${s.replace(/"/g, '""')}"`;
}
function exportCSV() {
  const all = getStudents();
  const filtered = sortStudents(filterStudents(all));
  if (!filtered.length) { alert("Não existem dados para exportar."); return; }

  const head = ["ID","Nome","Telefone","Nascimento","Sexo","Classe","Curso",
                "Endereço","Encarregado","Contacto Encarregado","Data/Hora",
                "Pagamento Feito","Valor do Pagamento"];
  const rows = filtered.map(({ s, idx }) => [
    idx + 1, s.nome, s.telefone, s.data_nascimento, s.sexo, s.classe,
    s.curso, s.endereco, s.encarregado, s.telefone_encarregado, s.criado_em,
    s.pagamento_feito === "sim" ? "Sim" : "Não",
    s.pagamento_feito === "sim" ? (s.valor_pagamento ?? "") : ""
  ]);
  const csv = [head, ...rows].map((r) => r.map(csvSafe).join(";")).join("\r\n");

  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const aEl = document.createElement("a");
  aEl.href = url;
  aEl.download = `alunos_comunidade_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(aEl);
  aEl.click();
  aEl.remove();
  URL.revokeObjectURL(url);
}

/* =========================================================
   NETLIFY FORMS — backup online
   ========================================================= */
function enviarParaNetlify(aluno, numero) {
  try {
    const dados = {
      "form-name": NETLIFY_FORM_NAME,
      nome: aluno.nome || "",
      telefone: aluno.telefone || "",
      data_nascimento: aluno.data_nascimento || "",
      sexo: aluno.sexo || "",
      classe: aluno.classe || "",
      curso: aluno.curso || "",
      endereco: aluno.endereco || "",
      encarregado: aluno.encarregado || "",
      telefone_encarregado: aluno.telefone_encarregado || "",
      pagamento_feito: aluno.pagamento_feito || "nao",
      valor_pagamento: aluno.valor_pagamento != null ? String(aluno.valor_pagamento) : "",
      numero_cadastro: numero,
      criado_em: aluno.criado_em || new Date().toISOString()
    };

    const body = new URLSearchParams(dados).toString();

    fetch("/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body
    })
    .then((r) => {
      if (r.ok) console.info("✅ Backup Netlify Forms enviado.");
      else console.warn("Netlify Forms resposta:", r.status);
    })
    .catch((err) => console.warn("Netlify Forms falhou:", err));
  } catch (err) {
    console.warn("Netlify Forms erro:", err);
  }
}

/* =========================================================
   FORMULÁRIO DE CADASTRO
   ========================================================= */
function setupCadastroForm() {
  const form = document.getElementById("cadastroForm");
  if (!form) return;

  const msg = document.getElementById("message");
  const submitBtn = form.querySelector('button[type="submit"]');
  const valorWrap = document.getElementById("valorPagamentoWrap");
  const valorInput = form.querySelector('input[name="valor_pagamento"]');
  const radiosPag = form.querySelectorAll('input[name="pagamento_feito"]');

  const birthInput = form.querySelector('input[name="data_nascimento"]');
  if (birthInput) {
    const today = new Date();
    birthInput.max = today.toISOString().slice(0, 10);
    const min = new Date(); min.setFullYear(min.getFullYear() - MAX_IDADE);
    birthInput.min = min.toISOString().slice(0, 10);
  }

  form.querySelectorAll('input[name="telefone"], input[name="telefone_encarregado"]')
    .forEach((inp) => inp.addEventListener("input", () => { inp.value = maskPhone(inp.value); }));

  function toggleValor() {
    const escolha = form.querySelector('input[name="pagamento_feito"]:checked')?.value;
    if (escolha === "sim") {
      valorWrap.hidden = false;
      valorInput.required = true;
    } else {
      valorWrap.hidden = true;
      valorInput.required = false;
      valorInput.value = "";
    }
  }
  radiosPag.forEach((r) => r.addEventListener("change", toggleValor));
  toggleValor();

  const show = (type, html) => {
    if (!msg) return;
    msg.className = "message " + type;
    msg.innerHTML = html;
  };

  const total = getStudents().length;
  const lim = getLimit();
  if (total >= lim) {
    submitBtn.disabled = true;
    submitBtn.classList.add("loading");
    submitBtn.textContent = "Vagas esgotadas";
    show("error", `O limite de ${lim} cadastros foi atingido. Novas inscrições estão bloqueadas.`);
    return;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (submitBtn.disabled) return;

    const current = getStudents();
    const limit = getLimit();
    if (current.length >= limit) {
      show("error", `O limite de ${limit} cadastros foi atingido.`);
      return;
    }

    const data = Object.fromEntries(new FormData(form).entries());
    data.nome = String(data.nome || "").trim();
    data.telefone = maskPhone(data.telefone);
    data.classe = String(data.classe || "").trim();
    data.data_nascimento = String(data.data_nascimento || "").trim();
    data.pagamento_feito = String(data.pagamento_feito || "").trim();

    if (data.nome.length < 3)
      return show("error", "Informe o nome completo (mínimo 3 caracteres).");
    if (normPhone(data.telefone).length < 9)
      return show("error", "O telefone deve ter 9 dígitos (ex.: 923 000 000).");
    if (!data.classe)
      return show("error", "Informe a classe / nível do aluno.");
    if (data.data_nascimento && !validateBirthdate(data.data_nascimento))
      return show("error", "Data de nascimento inválida.");
    if (data.telefone_encarregado && normPhone(data.telefone_encarregado).length < 9)
      return show("error", "O contacto do encarregado deve ter 9 dígitos.");

    if (data.pagamento_feito !== "sim" && data.pagamento_feito !== "nao")
      return show("error", "Responde se já fizeste o pagamento.");

    if (data.pagamento_feito === "sim") {
      const v = Number(data.valor_pagamento);
      if (!Number.isFinite(v) || v <= 0)
        return show("error", "Insere o valor do pagamento (maior que 0).");
      data.valor_pagamento = v;
    } else {
      data.valor_pagamento = null;
    }

    const telNorm = normPhone(data.telefone);
    if (current.some((s) => normPhone(s.telefone) === telNorm)) {
      return show("error", "Este número de telefone já possui um cadastro.");
    }

    submitBtn.disabled = true;
    submitBtn.classList.add("loading");

    try {
      await new Promise((r) => setTimeout(r, 180));
      const latest = getStudents();
      if (latest.length >= limit)
        return show("error", `O limite de ${limit} cadastros foi atingido.`);
      if (latest.some((s) => normPhone(s.telefone) === telNorm))
        return show("error", "Este número de telefone já possui um cadastro.");

      data.id = genId();
      data.criado_em = new Date().toISOString();
      latest.push(data);
      saveStudents(latest);

      const numero = String(latest.length).padStart(3, "0");

      /* 🔥 1. Firebase: incrementa contador global */
      if (typeof fbIncrementar === "function") {
        fbIncrementar().catch((err) => console.warn("Firebase:", err.message));
      }

      /* ☁️ 2. Netlify Forms: backup completo */
      enviarParaNetlify(data, numero);

      /* 📱 3. Mostra comprovativo ao aluno */
      const restam = Math.max(0, limit - latest.length);
      const restamTxt = restam === 0
        ? "⚠️ <strong>Última vaga preenchida.</strong>"
        : `Restam <strong>${restam}</strong> vaga${restam === 1 ? "" : "s"}.`;

      const pagamentoInfo = data.pagamento_feito === "sim"
        ? `<div class="receipt-payment">
             <strong>✅ Pagamento feito</strong>
             <span class="receipt-valor">${esc(formatarValor(data.valor_pagamento))}</span>
           </div>`
        : `<div class="receipt-payment pending">
             <strong>⏳ Pagamento pendente</strong>
             <span class="receipt-valor">Ainda não efetuado</span>
           </div>`;

      const waLink = buildComprovativoWhatsAppLink(data, numero);

      show(
        "success",
        `<div class="receipt">
           <div class="receipt-header">COMPROVATIVO DE CADASTRO</div>
           <div class="receipt-body">
             <p class="receipt-name">${esc(data.nome)}</p>
             <p class="receipt-num">Nº do cadastro: <strong>${numero}</strong></p>
             ${pagamentoInfo}
             <p class="receipt-restam"><small>${restamTxt}</small></p>
           </div>
         </div>

         <div class="send-receipt-box">
           <div class="send-receipt-title">
             <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
               <path d="M22 2L11 13"/>
               <path d="M22 2l-7 20-4-9-9-4 20-7z"/>
             </svg>
             Próximo passo
           </div>
           <p class="send-receipt-text">
             Envia o comprovativo para a <strong>Líder da comunidade</strong> no seu WhatsApp,
             juntamente com o <strong>comprovativo de pagamento</strong>!
           </p>
           <a class="btn-whatsapp-receipt"
              href="${waLink}"
              target="_blank" rel="noopener">
             <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
               <path d="M20.52 3.48A11.9 11.9 0 0 0 12.06 0C5.5 0 .16 5.34.16 11.9c0 2.1.55 4.15 1.6 5.96L0 24l6.3-1.65a11.9 11.9 0 0 0 5.76 1.47h.01c6.56 0 11.9-5.34 11.9-11.9 0-3.18-1.24-6.17-3.45-8.44zM12.07 21.5h-.01a9.9 9.9 0 0 1-5.05-1.38l-.36-.21-3.74.98 1-3.65-.24-.37a9.86 9.86 0 0 1-1.51-5.27c0-5.45 4.43-9.88 9.9-9.88 2.64 0 5.12 1.03 6.98 2.9a9.8 9.8 0 0 1 2.9 6.99c0 5.45-4.44 9.89-9.87 9.89zm5.43-7.1c-.3-.15-1.77-.87-2.04-.97-.27-.1-.47-.15-.67.15s-.77.97-.94 1.17c-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.07-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51l-.57-.01c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48 0 1.46 1.06 2.88 1.21 3.08.15.2 2.09 3.2 5.06 4.49.71.3 1.26.49 1.69.63.71.23 1.36.19 1.87.12.57-.08 1.77-.72 2.02-1.42.25-.7.25-1.29.17-1.42-.07-.13-.27-.2-.57-.35z"/>
             </svg>
             Abrir WhatsApp da Líder
           </a>
           <small class="send-receipt-hint">
             📎 Não te esqueças de anexar o comprovativo de pagamento na conversa.
           </small>
         </div>`
      );
      form.reset();
      toggleValor();
      refreshStats();

      if (typeof sendNewStudentNotifications === "function") {
        sendNewStudentNotifications(data, numero).catch((err) =>
          console.warn("Notificações falharam:", err)
        );
      }
    } catch (err) {
      console.error(err);
      show("error", "Ocorreu um erro ao guardar. Tente novamente.");
    } finally {
      submitBtn.disabled = false;
      submitBtn.classList.remove("loading");
    }
  });
}

/* =========================================================
   ACESSO SECRETO
   ========================================================= */
function setupSecretAdminAccess() {
  const path = location.pathname.toLowerCase();
  if (path.endsWith("admin.html")) return;

  const logo = document.getElementById("secretLogo");
  if (logo) {
    let count = 0, timer;
    logo.addEventListener("click", () => {
      count++;
      clearTimeout(timer);
      if (count >= 5) {
        count = 0;
        if (askAdminQuestion()) location.href = "admin.html";
      } else {
        timer = setTimeout(() => { count = 0; }, 2000);
      }
    });
  }

  document.addEventListener("keydown", (e) => {
    if (e.ctrlKey && e.shiftKey && (e.key === "A" || e.key === "a")) {
      e.preventDefault();
      if (askAdminQuestion()) location.href = "admin.html";
    }
  });
}

/* =========================================================
   REVELAÇÃO AO SCROLL
   ========================================================= */
function setupReveal() {
  const els = document.querySelectorAll(".reveal");
  if (!els.length) return;
  if (!("IntersectionObserver" in window)) {
    els.forEach((el) => el.classList.add("visible"));
    return;
  }
  const obs = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("visible");
        obs.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
  els.forEach((el) => obs.observe(el));
}

function setFooterYear() {
  const y = document.getElementById("year");
  if (y) y.textContent = new Date().getFullYear();
}

/* =========================================================
   BOOTSTRAP
   ========================================================= */
document.addEventListener("DOMContentLoaded", () => {
  migrate();
  setFooterYear();
  refreshStats();
  setupReveal();
  setupSecretAdminAccess();
  setupCadastroForm();

  const table = document.getElementById("students");
  if (table) {
    table.addEventListener("click", (e) => {
      const del = e.target.closest(".delete");
      const notify = e.target.closest(".notify");

      if (del && del.dataset.id) {
        removeStudent(del.dataset.id);
        return;
      }

      if (notify && notify.dataset.notify) {
        const id = notify.dataset.notify;
        notify.disabled = true;
        notify.classList.add("loading");

        (async () => {
          try {
            const all = getStudents();
            const idx = all.findIndex((s) => s.id === id);
            if (idx === -1) { showToast("Aluno não encontrado.", "warn"); return; }
            const aluno = all[idx];
            const numero = String(idx + 1).padStart(3, "0");

            if (typeof sendNewStudentNotifications !== "function") {
              showToast("⚠️ Módulo de notificações não carregado.", "warn");
              return;
            }

            const res = await sendNewStudentNotifications(aluno, numero);
            if (res.enviados > 0) {
              showToast(`✅ <strong>${res.enviados}</strong> notificação(ões) enviada(s).`, "success");
            } else if (res.falhados > 0) {
              showToast(
                `⚠️ Nenhuma enviada. <a href="#" data-wa="${aluno.id}">Abrir WhatsApp</a> · <a href="#" data-mail="${aluno.id}">Abrir e-mail</a>`,
                "warn", 6000
              );
              document.querySelectorAll(`[data-wa="${aluno.id}"]`).forEach(a => {
                a.addEventListener("click", (ev) => {
                  ev.preventDefault();
                  openWhatsAppManual(aluno, numero, "ceo");
                });
              });
              document.querySelectorAll(`[data-mail="${aluno.id}"]`).forEach(a => {
                a.addEventListener("click", (ev) => {
                  ev.preventDefault();
                  openEmailManual(aluno, numero, "subceo");
                });
              });
            } else {
              showToast("⚠️ Notificações não configuradas em <code>config.js</code>.", "warn");
            }
          } catch (err) {
            console.error(err);
            showToast("❌ Erro: " + (err?.message || err), "error");
          } finally {
            notify.disabled = false;
            notify.classList.remove("loading");
          }
        })();
      }
    });

    const search = document.getElementById("searchInput");
    if (search) {
      search.addEventListener("input", debounce(() => {
        ui.busca = search.value;
        ui.pagina = 1;
        renderStudents();
      }, 250));
    }

    const classeFilter = document.getElementById("classeFilter");
    if (classeFilter) {
      const classes = [...new Set(getStudents().map((s) => s.classe).filter(Boolean))].sort();
      classeFilter.innerHTML =
        `<option value="">Todas as classes</option>` +
        classes.map((c) => `<option value="${esc(c)}">${esc(c)}</option>`).join("");
      classeFilter.addEventListener("change", () => {
        ui.classe = classeFilter.value;
        ui.pagina = 1;
        renderStudents();
      });
    }

    const perPage = document.getElementById("perPage");
    if (perPage) {
      perPage.value = String(ui.porPagina);
      perPage.addEventListener("change", () => {
        ui.porPagina = Number(perPage.value) || 10;
        ui.pagina = 1;
        renderStudents();
      });
    }

    const clearBtn = document.getElementById("clearFilters");
    if (clearBtn) {
      clearBtn.addEventListener("click", () => {
        ui.busca = ""; ui.classe = ""; ui.pagina = 1;
        if (search) search.value = "";
        if (classeFilter) classeFilter.value = "";
        renderStudents();
      });
    }

    document.querySelectorAll("th.sortable").forEach((th) => {
      th.addEventListener("click", () => {
        const campo = th.dataset.sort;
        if (ui.ordenarPor === campo) {
          ui.direcao = ui.direcao === "asc" ? "desc" : "asc";
        } else {
          ui.ordenarPor = campo;
          ui.direcao = campo === "criado_em" ? "desc" : "asc";
        }
        ui.pagina = 1;
        renderStudents();
      });
    });

    document.getElementById("pagination")?.addEventListener("click", (e) => {
      const b = e.target.closest("button[data-page]");
      if (!b || b.disabled) return;
      const p = b.dataset.page;
      const total = filterStudents(getStudents()).length;
      const pages = Math.max(1, Math.ceil(total / ui.porPagina));
      if      (p === "first") ui.pagina = 1;
      else if (p === "prev")  ui.pagina = Math.max(1, ui.pagina - 1);
      else if (p === "next")  ui.pagina = Math.min(pages, ui.pagina + 1);
      else if (p === "last")  ui.pagina = pages;
      else                    ui.pagina = Number(p) || 1;
      renderStudents();
    });

    renderStudents();
  }

  if (document.getElementById("notifList") && typeof renderNotifPanel === "function") {
    renderNotifPanel();
    const btnClearNotif = document.getElementById("btnClearNotif");
    if (btnClearNotif) {
      btnClearNotif.addEventListener("click", () => {
        if (confirm("Limpar todo o histórico de notificações?")) {
          if (typeof clearNotifLog === "function") {
            clearNotifLog();
            renderNotifPanel();
          }
        }
      });
    }
  }

  window.addEventListener("storage", (e) => {
    if (e.key === KEY || e.key === LIMIT_KEY) {
      refreshStats();
      renderStudents();
    }
  });

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      refreshStats();
      renderStudents();
    }
  });
});