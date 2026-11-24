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

/* ---------- Impressão no celular: força o layout A4 (794px) ---------- */
function injetarCssImpressao() {
  if (document.getElementById("print-mobile-rat")) return;
  const st = document.createElement("style");
  st.id = "print-mobile-rat";
  st.textContent = "@media print{" +
    "html,body{width:794px !important;min-width:0 !important;height:950px !important;max-height:950px !important;overflow:hidden !important;display:block !important;margin:0 !important;padding:0 !important;background:#fff !important}" +
    "#relatorio{zoom:0.88 !important;width:794px !important;height:1120px !important;max-height:1120px !important;margin:0 !important;box-shadow:none !important;border:none !important;overflow:hidden !important;break-after:avoid !important;page-break-after:avoid !important;break-inside:avoid !important}" +
    "input[type=datetime-local],input[type=date]{-webkit-appearance:none !important;appearance:none !important;height:20px !important;min-height:0 !important;line-height:14px !important;padding:2px 3px !important;text-align:left !important;display:block !important}" +
    "}";
  document.head.appendChild(st);
}
injetarCssImpressao();

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

function autoTamanho(el, minimo) {
  if (!el) return;
  el.style.height = "auto";
  el.style.height = Math.max(minimo, el.scrollHeight + 2) + "px";
}
function cabeNaLinha(el) {
  if (!el) return;
  el.style.fontSize = "";
  let fs = parseFloat(getComputedStyle(el).fontSize) || 13;
  let n = 0;
  while (el.scrollWidth > el.clientWidth && fs > 7 && n++ < 40) {
    fs -= 0.5;
    el.style.fontSize = fs + "px";
  }
}
function ajustaTextos() {
  ["rat-site", "rat-endereco", "rat-resp", "rat-tecnico", "rat-operador"].forEach((id) => cabeNaLinha(document.getElementById(id)));
  autoTamanho(document.getElementById("rat-justificativa"), 30);
  autoTamanho(document.getElementById("rat-descricao"), 60);
}

function preencherFim() { preencher("rat-fim", agoraLocal()); }

/* ---------- Assinatura em tela cheia (igual ao Termo de Entrega) ---------- */
function assinaturaTelaCheia() {
  const m = document.getElementById("modalAssinatura");
  const cv = document.getElementById("canvasModal");
  if (!m || !cv || m.dataset.fs) return;
  m.dataset.fs = "1";
  const MOBq = () => window.matchMedia("(max-width:900px),(pointer:coarse)").matches;
  const st = document.createElement("style");
  st.textContent =
    "@media (max-width:900px),(pointer:coarse){" +
    "#modalAssinatura{background:#fff !important;align-items:stretch !important;justify-content:stretch !important}" +
    "#modalAssinatura .modal-content{width:100% !important;max-width:none !important;height:100vh;height:100dvh;border-radius:0 !important;padding:0 !important;margin:0;box-sizing:border-box;display:flex;flex-direction:column;overflow:hidden}" +
    "#modalAssinatura h3{margin:0 !important;padding:10px;background:#f2f2f2;font-size:18px}" +
    "#modalAssinatura .modal-content>div{padding:15px;background:#eee;margin:0 !important}" +
    "#modalAssinatura .modal-content>div button{flex:1;padding:12px !important;font-weight:bold}" +
    "canvas#canvasModal{width:100% !important;height:calc(100vh - 150px) !important;height:calc(100dvh - 150px) !important;border:none !important;flex:none}" +
    "}" +
    ".sig-hint{display:none;position:absolute;left:0;right:0;top:38%;text-align:center;font:bold 18px Arial,sans-serif;color:#b5b5b5;pointer-events:none;z-index:1}" +
    "@media (orientation:portrait) and (max-width:900px),(orientation:portrait) and (pointer:coarse){.sig-hint{display:block}}" +
    ".signature-pad img{max-width:100%;object-fit:contain}";
  document.head.appendChild(st);
  const hint = document.createElement("div");
  hint.className = "sig-hint";
  hint.innerHTML = "&#8635; Vire o celular na horizontal<br>para assinar";
  m.appendChild(hint);

  const penW = () => {
    const vv = window.visualViewport, sc = vv && vv.scale ? vv.scale : 1;
    return MOBq() ? Math.max(3, Math.min(12, Math.round(2.4 / sc))) : 3;
  };
  const trim = (c) => {
    const w = c.width, h = c.height, d = c.getContext("2d").getImageData(0, 0, w, h).data;
    let x0 = w, y0 = h, x1 = -1, y1 = -1;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (d[(y * w + x) * 4 + 3] > 10) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    }
    if (x1 < 0) return c.toDataURL("image/png");
    const p = 8;
    x0 = Math.max(0, x0 - p); y0 = Math.max(0, y0 - p); x1 = Math.min(w - 1, x1 + p); y1 = Math.min(h - 1, y1 + p);
    const o = document.createElement("canvas");
    o.width = x1 - x0 + 1; o.height = y1 - y0 + 1;
    o.getContext("2d").drawImage(c, x0, y0, o.width, o.height, 0, 0, o.width, o.height);
    return o.toDataURL("image/png");
  };
  const setI = (el, p, v) => el.style.setProperty(p, v, "important");
  const fit = () => {
    const vv = window.visualViewport;
    if (!vv || !MOBq()) return;
    setI(m, "left", vv.offsetLeft + "px"); setI(m, "top", vv.offsetTop + "px");
    setI(m, "width", vv.width + "px"); setI(m, "height", vv.height + "px");
    const box = m.querySelector(".modal-content");
    /* tamanhos proporcionais a altura da tela (evita botoes/titulo gigantes quando a pagina e ampliada) */
    const u = Math.min(vv.height, vv.width * 0.45) / 100; /* limitado pela largura: em pe a altura e enorme */
    const h3 = box.querySelector("h3");
    Array.prototype.forEach.call(box.children, (c) => {
      if (c.tagName !== "DIV") return;
      setI(c, "padding", (1.6 * u) + "px"); setI(c, "gap", (1.6 * u) + "px");
      Array.prototype.forEach.call(c.querySelectorAll("button"), (b) => {
        setI(b, "padding", (1.8 * u) + "px"); setI(b, "font-size", (2.6 * u) + "px"); setI(b, "border-radius", (1 * u) + "px");
      });
    });
    if (h3) { setI(h3, "font-size", (3 * u) + "px"); setI(h3, "padding", (1.2 * u) + "px"); }
    const hintEl = m.querySelector(".sig-hint");
    if (hintEl) setI(hintEl, "font-size", (3.4 * u) + "px");
    const bs = getComputedStyle(box);
    let extra = (parseFloat(bs.paddingTop) || 0) + (parseFloat(bs.paddingBottom) || 0);
    Array.prototype.forEach.call(box.children, (c) => {
      if (c === cv) return;
      const cs = getComputedStyle(c);
      extra += c.offsetHeight + (parseFloat(cs.marginTop) || 0) + (parseFloat(cs.marginBottom) || 0);
    });
    setI(box, "height", vv.height + "px");
    setI(cv, "height", Math.max(120, vv.height - extra - 4) + "px");
  };

  const abrirOriginal = window.openModal;
  if (typeof abrirOriginal === "function") {
    window.openModal = function (a) {
      abrirOriginal(a); fit(); abrirOriginal(a);
      cv.getContext("2d").lineWidth = penW();
    };
  }
  window.salvarAssinatura = function () {
    const alvo = typeof currentTarget !== "undefined" ? currentTarget : "";
    const box = document.getElementById("box-" + alvo);
    if (box) box.innerHTML = '<img src="' + trim(cv) + '" style="max-height:100%;max-width:100%;object-fit:contain;mix-blend-mode:multiply">';
    if (typeof fecharModal === "function") fecharModal();
  };
  const mq = window.matchMedia("(orientation:portrait)");
  const rs = () => setTimeout(() => {
    if (m.style.display === "flex") { try { window.openModal(typeof currentTarget !== "undefined" ? currentTarget : "cli"); } catch (e) {} }
  }, 350);
  if (mq.addEventListener) mq.addEventListener("change", rs); else if (mq.addListener) mq.addListener(rs);
}
assinaturaTelaCheia();

/* ---------- Colar texto do chamado (Telmex) ---------- */
const norm = (t) => String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

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
  const mCli = texto.match(/(?:^|\n)[ \t]*CLIENTE[ \t]*:[ \t]*([^\n]+)/i);
  const cli = mCli ? mCli[1].replace(/PRIME[ \t_-]?ID[ \t]*:.*$/i, "").trim() : "";
  /* Nome do site: PRIMEID do chamado (ex.: BRAD#3368-00#03); sem PRIMEID, usa cliente + cidade */
  const mPrime = texto.match(/PRIME[ \t_-]?ID[ \t]*:[ \t]*([^\s]+)/i);
  const nomeSite = mPrime ? mPrime[1].trim() : [cli, cidade.toUpperCase()].filter(Boolean).join(" - ");
  marca("Nome do Site", definir("rat-site", nomeSite));

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
  const mDesc = texto.match(/DESCRI[ÇC][ÃA]O[ \t]*:[ \t]*([^\n]+)/i);
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
  ["rat-justificativa", "rat-descricao", "rat-site", "rat-endereco", "rat-resp", "rat-tecnico", "rat-operador"].forEach((id) => {
    const t = document.getElementById(id);
    if (t) t.addEventListener("input", ajustaTextos);
  });
  window.addEventListener("resize", ajustaTextos);
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
    if (b && /GERAR/i.test(b.textContent)) { preencherFim(); ajustaTextos(); }
  }, true);
  window.addEventListener("beforeprint", () => { preencherFim(); ajustaTextos(); });
  ajustaTextos();

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

/* Assinatura suave (compartilhada com Termo e Caderno) */
(function () { const s = document.createElement("script"); s.src = "sig-suave.js"; document.head.appendChild(s); })();
