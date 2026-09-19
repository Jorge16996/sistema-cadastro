/* =========================================================
   app.js — Sistema de Cadastro de Alunos (v7)
   Agora 100% API MySQL — sem localStorage.
   ========================================================= */

const ADMIN_AUTH_KEY = "comunidade_admin_auth";
const MAX_LIMIT = 100000;

/* =========================================================
   GUARDA DE ACESSO ADMINISTRATIVO
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
  const resposta = prompt("🔒 Acesso restrito\n\nQual é o personagem preferido do ADM?");
  if (resposta === null) return false;
  if (isCorrectAdminAnswer(resposta)) {
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
   UTILITÁRIOS
   ========================================================= */
const normPhone = (t) => String(t ?? "").replace(/\D/g, "");
const normalize = (s) => String(s ?? "").toLowerCase()
  .normalize("NFD").replace(/[\u0300-\u036f]/g, "");

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
function debounce(fn, ms = 250) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

/* =========================================================
   ESTATÍSTICAS + VAGAS
   ========================================================= */
async function refreshStats() {
  let n = 0, l = 70;
  try {
    const [c, lim] = await Promise.all([apiContarAlunos(), apiObterLimite()]);
    n = c.total;
    l = lim.limite;
  } catch (err) {
    console.error("Falha ao atualizar estatísticas:", err.message);
    return;
  }

  const v = Math.max(0, l - n);
  const lotado = v === 0;
  const quaseCheio = !lotado && v <= Math.max(1, Math.floor(l * 0.10));

  [["total", n], ["dTotal", n]].forEach(([id, val]) => {
    const e = document.getElementById(id); if (e) e.textContent = val;
  });
  [["limite", l], ["dLimit", l]].forEach(([id, val]) => {
    const e = document.getElementById(id); if (e) e.textContent = val;
  });
  [["vagas", v], ["dAvailable", v]].forEach(([id, val]) => {
    const e = document.getElementById(id); if (e) e.textContent = val;
  });

  const bar = document.getElementById("vagasBar");
  if (bar) {
    const pct = l > 0 ? Math.min(100, (n / l) * 100) : 0;
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
  if (vagaEl) {
    vagaEl.classList.toggle("warn", quaseCheio);
    vagaEl.classList.toggle("full", lotado);
  }
  const vagaEl2 = document.getElementById("dAvailable");
  if (vagaEl2) {
    vagaEl2.classList.toggle("warn", quaseCheio);
    vagaEl2.classList.toggle("full", lotado);
  }

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

  const nl = document.getElementById("newLimit");
  if (nl) { nl.value = l; nl.max = MAX_LIMIT; }
}

/* ---------- Limite ---------- */
async function saveLimit() {
  const input = document.getElementById("newLimit");
  const n = Number(input.value);

  if (!Number.isInteger(n) || n < 1 || n > MAX_LIMIT) {
    alert(`Informe um limite válido entre 1 e ${MAX_LIMIT}.`);
    return;
  }

  try {
    await apiGuardarLimite(n);
    await refreshStats();
    await renderStudents();
  } catch (err) {
    alert("Erro: " + err.message);
  }
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

/* =========================================================
   TABELA
   ========================================================= */
async function renderStudents() {
  const tbody = document.getElementById("students");
  if (!tbody) return;

  tbody.innerHTML = `<tr><td colspan="6" class="empty">A carregar…</td></tr>`;

  let data;
  try {
    data = await apiListarAlunos({
      q: ui.busca,
      classe: ui.classe,
      pagina: ui.pagina,
      por_pagina: ui.porPagina,
      ordenar_por: ui.ordenarPor,
      direcao: ui.direcao
    });
  } catch (err) {
    console.error("[renderStudents]", err);
    tbody.innerHTML = `<tr><td colspan="6" class="empty">Erro ao carregar: ${esc(err.message)}</td></tr>`;
    return;
  }

  const { alunos, total, pagina, total_paginas } = data;

  if (!alunos.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty">Nenhum aluno encontrado.</td></tr>`;
  } else {
    const offset = (pagina - 1) * ui.porPagina;
    tbody.innerHTML = alunos.map((s, i) => {
      const num = String(offset + i + 1).padStart(3, "0");
      const id = esc(s.id);
      return `<tr>
        <td data-label="Nº">${num}</td>
        <td data-label="Nome">${esc(s.nome)}</td>
        <td data-label="Telefone">${esc(s.telefone)}</td>
        <td data-label="Classe">${esc(s.classe)}</td>
        <td data-label="Data / Hora">${esc(formatDate(s.criado_em))}</td>
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

  renderPagination(total, total_paginas);
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

/* ---------- Eliminação ---------- */
async function removeStudent(id) {
  if (!id) return;
  if (!confirm("Eliminar este cadastro? Esta ação não pode ser desfeita.")) return;
  try {
    await apiEliminarAluno(id);
    await refreshStats();
    await renderStudents();
  } catch (err) {
    alert("Erro: " + err.message);
  }
}

/* =========================================================
   EXPORTAÇÃO CSV
   ========================================================= */
function csvSafe(v) {
  let s = String(v ?? "");
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return `"${s.replace(/"/g, '""')}"`;
}
async function exportCSV() {
  let data;
  try {
    data = await apiListarAlunos({
      q: ui.busca,
      classe: ui.classe,
      pagina: 1,
      por_pagina: 10000,
      ordenar_por: ui.ordenarPor,
      direcao: ui.direcao
    });
  } catch (err) {
    alert("Erro ao exportar: " + err.message);
    return;
  }

  const alunos = data.alunos || [];
  if (!alunos.length) { alert("Não existem dados para exportar."); return; }

  const head = ["ID", "Nome", "Telefone", "Nascimento", "Sexo", "Classe", "Curso",
                "Endereço", "Encarregado", "Contacto Encarregado", "Data/Hora"];
  const rows = alunos.map((s) => [
    s.id, s.nome, s.telefone, s.data_nascimento, s.sexo, s.classe,
    s.curso, s.endereco, s.encarregado, s.telefone_encarregado, s.criado_em
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
   FORMULÁRIO DE CADASTRO
   ========================================================= */
function setupCadastroForm() {
  const form = document.getElementById("cadastroForm");
  if (!form) return;

  const msg = document.getElementById("message");
  const submitBtn = form.querySelector('button[type="submit"]');

  const birthInput = form.querySelector('input[name="data_nascimento"]');
  if (birthInput) {
    const today = new Date();
    birthInput.max = today.toISOString().slice(0, 10);
    const min = new Date(); min.setFullYear(min.getFullYear() - 120);
    birthInput.min = min.toISOString().slice(0, 10);
  }

  form.querySelectorAll('input[name="telefone"], input[name="telefone_encarregado"]')
    .forEach((inp) => inp.addEventListener("input", () => { inp.value = maskPhone(inp.value); }));

  const show = (type, html) => {
    if (!msg) return;
    msg.className = "message " + type;
    msg.innerHTML = html;
  };

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (submitBtn.disabled) return;

    const data = Object.fromEntries(new FormData(form).entries());
    data.nome = String(data.nome || "").trim();
    data.telefone = maskPhone(data.telefone);
    data.classe = String(data.classe || "").trim();
    data.data_nascimento = String(data.data_nascimento || "").trim();

    if (data.nome.length < 3)
      return show("error", "Informe o nome completo (mínimo 3 caracteres).");
    if (normPhone(data.telefone).length < 9)
      return show("error", "O telefone deve ter 9 dígitos (ex.: 923 000 000).");
    if (!data.classe)
      return show("error", "Informe a classe / nível do aluno.");
    if (data.telefone_encarregado && normPhone(data.telefone_encarregado).length < 9)
      return show("error", "O contacto do encarregado deve ter 9 dígitos.");

    submitBtn.disabled = true;
    submitBtn.classList.add("loading");

    try {
      const res = await apiCriarAluno(data);
      const numero = res.numero;

      const stats = await apiContarAlunos();
      const lim = (await apiObterLimite()).limite;
      const restam = Math.max(0, lim - stats.total);
      const restamTxt = restam === 0
        ? "⚠️ <strong>Última vaga preenchida.</strong>"
        : `Restam <strong>${restam}</strong> vaga${restam === 1 ? "" : "s"}.`;

      show(
        "success",
        `Cadastro realizado com sucesso!<br>
         <strong>Número do cadastro: ${numero}</strong><br>
         <small>${restamTxt}</small>`
      );
      form.reset();

      /* 🔔 Notificações */
      if (typeof sendNewStudentNotifications === "function") {
        sendNewStudentNotifications(res.aluno, numero).catch((err) =>
          console.warn("Notificações falharam:", err)
        );
      }
    } catch (err) {
      console.error(err);
      show("error", err.message || "Erro ao guardar. Tente novamente.");
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
document.addEventListener("DOMContentLoaded", async () => {
  setFooterYear();
  await refreshStats();

  /* ----- Painel admin ----- */
  const table = document.getElementById("students");
  if (table) {
    /* Botões editar/eliminar/notificar — delegação */
    table.addEventListener("click", async (e) => {
      const del = e.target.closest(".delete");
      const notify = e.target.closest(".notify");

      if (del && del.dataset.id) {
        await removeStudent(Number(del.dataset.id));
        return;
      }

      if (notify && notify.dataset.notify) {
        const id = Number(notify.dataset.notify);
        notify.disabled = true;
        notify.classList.add("loading");
        try {
          const r = await apiObterAluno(id);
          const aluno = r.aluno;
          const numero = String(aluno.id).padStart(3, "0");

          if (typeof sendNewStudentNotifications !== "function") {
            showToast("⚠️ Módulo de notificações não carregado.", "warn");
            return;
          }

          const res = await sendNewStudentNotifications(aluno, numero);
          if (res.enviados > 0) {
            showToast(
              `✅ <strong>${res.enviados}</strong> notificação(ões) enviada(s) para a equipa.`,
              "success"
            );
          } else if (res.falhados > 0) {
            showToast(
              `⚠️ Nenhuma enviada. <a href="#" data-wa="${aluno.id}">Abrir WhatsApp</a> · <a href="#" data-mail="${aluno.id}">Abrir e-mail</a>`,
              "warn",
              6000
            );
            document.querySelectorAll(`[data-wa="${aluno.id}"]`).forEach(a => {
              a.addEventListener("click", (ev) => {
                ev.preventDefault();
                if (typeof openWhatsAppManual === "function")
                  openWhatsAppManual(aluno, numero, "ceo");
              });
            });
            document.querySelectorAll(`[data-mail="${aluno.id}"]`).forEach(a => {
              a.addEventListener("click", (ev) => {
                ev.preventDefault();
                if (typeof openEmailManual === "function")
                  openEmailManual(aluno, numero, "subceo");
              });
            });
          } else {
            showToast("⚠️ Notificações não configuradas em <code>config.js</code>.", "warn");
          }
        } catch (err) {
          console.error(err);
          showToast("❌ Erro ao notificar: " + (err?.message || err), "error");
        } finally {
          notify.disabled = false;
          notify.classList.remove("loading");
        }
      }
    });

    /* Busca */
    const search = document.getElementById("searchInput");
    if (search) {
      search.addEventListener("input", debounce(async () => {
        ui.busca = search.value;
        ui.pagina = 1;
        await renderStudents();
      }, 250));
    }

    /* Filtro de classes */
    const classeFilter = document.getElementById("classeFilter");
    if (classeFilter) {
      try {
        const r = await apiListarClasses();
        classeFilter.innerHTML =
          `<option value="">Todas as classes</option>` +
          r.classes.map((c) => `<option value="${esc(c)}">${esc(c)}</option>`).join("");
      } catch (err) {
        console.warn("Falha ao listar classes:", err.message);
      }
      classeFilter.addEventListener("change", async () => {
        ui.classe = classeFilter.value;
        ui.pagina = 1;
        await renderStudents();
      });
    }

    /* Itens por página */
    const perPage = document.getElementById("perPage");
    if (perPage) {
      perPage.value = String(ui.porPagina);
      perPage.addEventListener("change", async () => {
        ui.porPagina = Number(perPage.value) || 10;
        ui.pagina = 1;
        await renderStudents();
      });
    }

    /* Limpar filtros */
    const clearBtn = document.getElementById("clearFilters");
    if (clearBtn) {
      clearBtn.addEventListener("click", async () => {
        ui.busca = ""; ui.classe = ""; ui.pagina = 1;
        if (search) search.value = "";
        if (classeFilter) classeFilter.value = "";
        await renderStudents();
      });
    }

    /* Ordenação */
    document.querySelectorAll("th.sortable").forEach((th) => {
      th.addEventListener("click", async () => {
        const campo = th.dataset.sort;
        if (ui.ordenarPor === campo) {
          ui.direcao = ui.direcao === "asc" ? "desc" : "asc";
        } else {
          ui.ordenarPor = campo;
          ui.direcao = campo === "criado_em" ? "desc" : "asc";
        }
        ui.pagina = 1;
        await renderStudents();
      });
    });

    /* Paginação */
    document.getElementById("pagination")?.addEventListener("click", async (e) => {
      const b = e.target.closest("button[data-page]");
      if (!b || b.disabled) return;
      const p = b.dataset.page;
      if (p === "first") ui.pagina = 1;
      else if (p === "prev") ui.pagina = Math.max(1, ui.pagina - 1);
      else if (p === "next") ui.pagina = ui.pagina + 1;
      else if (p === "last") ui.pagina = 999999;
      else ui.pagina = Number(p) || 1;
      await renderStudents();
    });

    /* Primeira renderização */
    await renderStudents();
  }

  /* ----- Formulário de cadastro ----- */
  setupCadastroForm();

  /* ----- Acesso secreto ----- */
  setupSecretAdminAccess();

  /* ----- Revelação ao scroll ----- */
  setupReveal();

  /* ----- Painel de notificações ----- */
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

  /* ----- Re-sincronização ao voltar ao separador ----- */
  document.addEventListener("visibilitychange", async () => {
    if (!document.hidden) {
      await refreshStats();
      if (document.getElementById("students")) await renderStudents();
    }
  });
});