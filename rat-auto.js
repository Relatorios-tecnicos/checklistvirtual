/* Autopreenchimento do RAT (Telmex). Só preenche campos vazios; o técnico pode editar tudo. */
import { getApps, getApp, initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyA1CQ8LDia_nedDsttlbxKhFD9NMvj29Kw",
  authDomain: "checklistvirtual.firebaseapp.com",
  projectId: "checklistvirtual",
  storageBucket: "checklistvirtual.firebasestorage.app",
  messagingSenderId: "421292656328",
  appId: "1:421292656328:web:2a2d4eb79c64a54ba9c7fd"
};

const CLIENTE_PADRAO = "TELMEX";

const TEXTOS = {
  "201": "Realizado levantamento (survey) do local para viabilidade técnica: infraestrutura, energia, ponto de instalação e cabeamento.",
  "202": "Realizada a implantação no site: instalação física dos equipamentos, configuração, ativação e testes de conectividade com sucesso.",
  "203": "Executada a infraestrutura necessária no local (cabeamento e pontos), conforme solicitado.",
  "204": "Realizado acompanhamento da atividade técnica no site, com validação dos serviços executados.",
  "205": "Realizada a desinstalação e retirada dos equipamentos do site, com conferência dos números de série.",
  "206": "Realizada a migração do serviço, com configuração e testes de conectividade após a migração.",
  "207": "Realizada manutenção no site, com diagnóstico, correção da falha e testes de conectividade. Link operacional ao final do atendimento.",
  "208": "Realizado up/down-grade do serviço conforme solicitado, com reconfiguração e testes de validação.",
  "209": "Realizada reconfiguração do equipamento conforme solicitado, com testes de conectividade e validação.",
  "210": "Realizado remanejamento dos equipamentos no site, com reinstalação, configuração e testes.",
  "211": "Realizada mudança de layout no site, com reposicionamento dos equipamentos e testes de conectividade.",
  "212": "Realizada mudança de endereço do serviço, com desinstalação no local anterior e instalação, configuração e testes no novo endereço.",
  "213": "Realizada manutenção na infraestrutura do site (cabeamento, conectores e pontos), com testes de funcionamento.",
  "214": "Realizado serviço de ponto lógico, com teste de continuidade e funcionamento.",
  "215": "Realizada manutenção corretiva para restabelecer o serviço, com identificação da causa, correção e testes de conectividade."
};

const pad = (n) => String(n).padStart(2, "0");
const hojeISO = () => { const d = new Date(); return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); };
const agoraLocal = () => { const d = new Date(); return hojeISO() + "T" + pad(d.getHours()) + ":" + pad(d.getMinutes()); };

function preencher(id, valor) {
  const el = document.getElementById(id);
  if (!el || el.value || !valor) return;
  el.value = valor;
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

function textoDasAtividades() {
  return Object.keys(TEXTOS)
    .filter((c) => { const cb = document.getElementById("at-" + c); return cb && cb.checked; })
    .map((c) => TEXTOS[c])
    .join("\n");
}

let ultimoAuto = "";
function atualizaDescricao() {
  const d = document.getElementById("rat-descricao");
  if (!d) return;
  const atual = d.value.trim();
  if (atual && atual !== ultimoAuto.trim()) return; /* técnico editou: não mexe */
  const novo = textoDasAtividades();
  ultimoAuto = novo;
  d.value = novo;
  d.dispatchEvent(new Event("input", { bubbles: true }));
}

function preencherFim() { preencher("rat-fim", agoraLocal()); }

/* ---------- Colar texto do chamado (Telmex) ---------- */
const norm = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

function valorDe(linhas, rotulo) {
  const alvo = norm(rotulo);
  for (let i = 0; i < linhas.length; i++) {
    const l = linhas[i];
    if (norm(l) === alvo) {
      for (let j = i + 1; j < linhas.length; j++) if (linhas[j].trim()) return linhas[j].trim();
    }
    const m = l.match(/^\s*([^:]{2,40}):\s*(.+)$/);
    if (m && norm(m[1]) === alvo) return m[2].trim();
  }
  return "";
}

function definir(id, valor) {
  const el = document.getElementById(id);
  if (!el || !valor) return false;
  el.value = valor;
  el.dispatchEvent(new Event("input", { bubbles: true }));
  return true;
}

function dataISO(d) {
  const m = String(d).match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (!m) return "";
  const ano = m[3].length === 2 ? "20" + m[3] : m[3];
  return ano + "-" + pad(+m[2]) + "-" + pad(+m[1]);
}

function preencherDoChamado(texto) {
  const linhas = texto.split(/\r?\n/);
  const achou = [];
  const marca = (nome, ok) => { if (ok) achou.push(nome); };

  marca("Chamado", definir("rat-chamado", valorDe(linhas, "Id do Chamado")));
  marca("ID", definir("rat-id", valorDe(linhas, "Cliente Id")));

  const rua = valorDe(linhas, "Endereço");
  const cidade = valorDe(linhas, "Cidade");
  let cep = valorDe(linhas, "CEP/Código Postal").replace(/\D/g, "");
  if (cep.length === 8) cep = cep.slice(0, 5) + "-" + cep.slice(5);
  const end = [rua, cidade, cep ? "CEP " + cep : ""].filter(Boolean).join(" - ");
  marca("Endereço", definir("rat-endereco", end));

  /* Nome do site: cliente final + cidade (ex.: O BOTICÁRIO - INDAIATUBA) */
  const mCli = texto.match(/CLIENTE\s*:\s*([^\n]+)/i);
  const cli = mCli ? mCli[1].trim() : "";
  marca("Nome do Site", definir("rat-site", [cli, cidade.toUpperCase()].filter(Boolean).join(" - ")));

  const data = dataISO(valorDe(linhas, "Data"));
  const mh = valorDe(linhas, "Início - Fim").match(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/);
  if (data && mh) {
    marca("Início", definir("rat-inicio", data + "T" + pad(+mh[1]) + ":" + mh[2]));
    marca("Fim", definir("rat-fim", data + "T" + pad(+mh[3]) + ":" + mh[4]));
    definir("val-cli-data", data);
    definir("val-tec-data", data);
  }

  /* Tipo de atividade: casa pelo nome (ex.: Manutenção Corretiva -> 215) */
  const tipo = norm(valorDe(linhas, "Tipo de Atividade"));
  if (tipo) {
    document.querySelectorAll('input[id^="at-"]').forEach((cb) => {
      const nomeAt = norm((cb.parentElement.textContent || "").replace(/^\s*\(\s*\)\s*\d+\s*-\s*/, ""));
      const quer = nomeAt === tipo;
      if (cb.checked !== quer) { cb.checked = quer; cb.dispatchEvent(new Event("input", { bubbles: true })); cb.dispatchEvent(new Event("change", { bubbles: true })); }
      if (quer) achou.push("Tipo de atividade");
    });
  }

  /* Justificativa / anormalidade = "DESCRIÇÃO:" do chamado */
  const mDesc = texto.match(/DESCRI[ÇC][ÃA]O\s*:\s*([^\n]+)/i);
  if (mDesc) marca("Justificativa", definir("rat-justificativa", mDesc[1].trim().replace(/[,;\s]+$/, "")));

  return achou;
}

function abrirColar() {
  let m = document.getElementById("modalColarChamado");
  if (!m) {
    m = document.createElement("div");
    m.id = "modalColarChamado";
    m.className = "modal";
    m.innerHTML = '<div class="modal-content"><h3 style="margin-top:0">Cole o texto do chamado</h3>' +
      '<textarea id="txtColarChamado" style="width:100%;height:220px;font-size:13px;padding:6px;border:1px solid #333;"></textarea>' +
      '<div id="msgColarChamado" style="font-size:12px;margin-top:8px;min-height:16px;color:#333;"></div>' +
      '<div style="display:flex;justify-content:space-between;margin-top:10px;gap:10px;">' +
      '<button id="btnColarSair" style="background:#666;color:#fff;border:none;padding:10px;border-radius:4px;cursor:pointer;">Sair</button>' +
      '<button id="btnColarOk" style="background:#28a745;color:#fff;border:none;padding:10px;border-radius:4px;cursor:pointer;">Preencher</button></div></div>';
    document.body.appendChild(m);
    document.getElementById("btnColarSair").onclick = () => { m.style.display = "none"; };
    document.getElementById("btnColarOk").onclick = () => {
      const achou = preencherDoChamado(document.getElementById("txtColarChamado").value);
      if (achou.length) { m.style.display = "none"; }
      else document.getElementById("msgColarChamado").textContent = "Não encontrei dados do chamado nesse texto.";
    };
  }
  document.getElementById("txtColarChamado").value = "";
  document.getElementById("msgColarChamado").textContent = "";
  m.style.display = "flex";
}

function botaoColar() {
  const painel = document.querySelector(".btn-panel");
  if (!painel || document.getElementById("btnColarChamado")) return;
  const b = document.createElement("button");
  b.id = "btnColarChamado";
  b.textContent = "COLAR CHAMADO";
  b.style.background = "#1a73e8";
  b.onclick = abrirColar;
  painel.insertBefore(b, painel.firstChild);
}

function iniciar() {
  botaoColar();
  preencher("rat-cliente", CLIENTE_PADRAO);
  preencher("rat-inicio", agoraLocal());
  preencher("val-cli-data", hojeISO());
  preencher("val-tec-data", hojeISO());

  ultimoAuto = textoDasAtividades();
  Object.keys(TEXTOS).forEach((c) => {
    const cb = document.getElementById("at-" + c);
    if (cb) cb.addEventListener("change", atualizaDescricao);
  });

  /* Fim = hora de gerar o PDF, se ainda estiver vazio */
  document.addEventListener("click", (e) => {
    const b = e.target.closest && e.target.closest(".btn-panel button");
    if (b && /GERAR/i.test(b.textContent)) preencherFim();
  }, true);
  window.addEventListener("beforeprint", preencherFim);

  /* Nome do técnico = nome da conta Google */
  try {
    const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
    onAuthStateChanged(getAuth(app), (user) => {
      if (!user) return;
      const nome = (user.displayName || "").trim() || String(user.email || "").split("@")[0];
      preencher("rat-tecnico", nome);
      preencher("val-tec-nome", nome);
    });
  } catch (e) { console.error("Autopreenchimento do nome:", e); }
}

if (document.readyState === "complete") iniciar();
else window.addEventListener("load", iniciar);
