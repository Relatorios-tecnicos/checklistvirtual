/* Compartilhar PDF (RAT, Termo de Entrega e Caderno de Testes).
   O botão "COMPARTILHAR PDF" continua chamando window.print() com as mesmas conferências de antes
   (campos obrigatórios, linhas vazias, nome do arquivo). Este script troca o window.print():
   em vez de abrir a impressão, monta o PDF na própria página, com o layout da impressão (@media print),
   e abre a tela de compartilhar do celular (WhatsApp, e-mail, Drive...). No computador, baixa o arquivo.
   Se não conseguir gerar (ex.: sem internet para carregar a biblioteca), oferece a impressão antiga. */
(function () {
  "use strict";
  if (window.__pdfCompartilhar) return;
  window.__pdfCompartilhar = true;

  var LIB_VERSAO = "2.6.4";
  var LIB_URLS = [
    "https://cdn.jsdelivr.net/npm/html2canvas-pro@" + LIB_VERSAO + "/dist/html2canvas-pro.min.js",
    "https://unpkg.com/html2canvas-pro@" + LIB_VERSAO + "/dist/html2canvas-pro.min.js"
  ];
  var LIB_SRI = "sha384-cdIgRLgsj7/96PN5gfNytJnHsoo2mpew4+UtLHdjtWkiOpKIiOfshwmWtwgXDjtq";
  var ESCALA = 2;          /* 2x: ~190 dpi, texto nítido */
  var QUALIDADE = 0.9;     /* JPEG */
  var A4 = { w: 595.28, h: 841.89 }; /* pontos */

  var imprimirOriginal = window.print;

  /* ---------- compartilhar ou baixar ---------- */
  function podeCompartilharArquivo() {
    try {
      return !!(navigator.share && navigator.canShare &&
        navigator.canShare({ files: [new File(["%PDF-1.4"], "teste.pdf", { type: "application/pdf" })] }));
    } catch (e) { return false; }
  }
  var TOQUE = !!(window.matchMedia && matchMedia("(pointer:coarse)").matches);
  var COMPARTILHA = TOQUE && podeCompartilharArquivo();

  /* ---------- botão ---------- */
  function rotularBotao() {
    var bs = document.querySelectorAll(".btn-panel button, .botoes button");
    for (var i = 0; i < bs.length; i++) {
      if (/PDF/i.test(bs[i].textContent)) bs[i].textContent = COMPARTILHA ? "COMPARTILHAR PDF" : "BAIXAR PDF";
    }
  }

  /* ---------- qual app ---------- */
  function val(id) { var e = document.getElementById(id); return e ? String(e.value || "").trim() : ""; }
  function configApp() {
    if (document.getElementById("relatorio")) {
      return {
        seletor: "#relatorio",
        nome: function () { return ["RAT", val("rat-chamado"), val("rat-site")].filter(Boolean).join(" - "); },
        /* página A4 inteira, sem o zoom de 0,88 da impressão do celular; se o texto passar da folha, a folha cresce e o PDF reduz para caber */
        css: "#relatorio{zoom:1 !important;width:210mm !important;height:auto !important;min-height:297mm !important;max-height:none !important;overflow:visible !important;margin:0 !important;border:0 !important;box-shadow:none !important}"
      };
    }
    if (document.querySelector(".page")) {
      /* Termo de Entrega: a folha cresce se o conteúdo passar da altura (nada fica cortado); o Caderno mantém as folhas fixas */
      var termo = !!document.querySelector(".campo-assinatura");
      return { seletor: ".page", nome: function () { return document.title; },
        css: termo ? ".page{height:auto !important;min-height:940px !important;max-height:none !important;overflow:visible !important}" : "" };
    }
    return null;
  }

  function nomeArquivo(s) {
    s = String(s || "").replace(/[\\\/:*?"<>|#%&{}$!'`@+=~^\u0000-\u001f]+/g, "-")
      .replace(/\s+/g, " ").replace(/-{2,}/g, "-").replace(/^[\s.\-]+|[\s.\-]+$/g, "");
    if (s.length > 110) s = s.slice(0, 110).replace(/[\s.\-]+$/, "");
    return (s || "documento") + ".pdf";
  }

  /* ---------- biblioteca (carrega em segundo plano ao abrir a página) ---------- */
  var libPromessa = null;
  function carregarLib() {
    if (typeof window.html2canvas === "function") return Promise.resolve(window.html2canvas);
    if (libPromessa) return libPromessa;
    libPromessa = new Promise(function (ok, falha) {
      var i = 0;
      (function tenta() {
        if (i >= LIB_URLS.length) { libPromessa = null; falha(new Error("biblioteca")); return; }
        var s = document.createElement("script");
        s.src = LIB_URLS[i++];
        s.integrity = LIB_SRI;
        s.crossOrigin = "anonymous";
        s.async = true;
        s.onload = function () { typeof window.html2canvas === "function" ? ok(window.html2canvas) : tenta(); };
        s.onerror = function () { if (s.parentNode) s.parentNode.removeChild(s); tenta(); };
        document.head.appendChild(s);
      })();
    });
    return libPromessa;
  }

  /* ---------- cópia da página com o layout de impressão ----------
     A cópia é feita numa moldura (iframe) escondida, com as regras @media print valendo como na impressão.
     Nela os campos viram texto comum (o desenho fica igual ao do navegador) e só então vira imagem. */
  function trocaMidia(txt) {
    return String(txt).split(",").map(function (q) {
      var t = q.trim();
      if (/^(only\s+)?print\b/i.test(t)) return t.replace(/^(only\s+)?print\b/i, "all");
      if (/^not\s+print\b/i.test(t) || /^(only\s+)?screen\b/i.test(t)) return "not all";
      return t;
    }).join(", ");
  }
  function percorreRegras(regras) {
    for (var i = 0; i < regras.length; i++) {
      var r = regras[i];
      if (r.type === 4 && r.media) {
        var novo = trocaMidia(r.media.mediaText);
        if (novo !== r.media.mediaText) { try { r.media.mediaText = novo; } catch (e) {} }
      }
      if (r.cssRules) { try { percorreRegras(r.cssRules); } catch (e) {} }
    }
  }
  /* as regras @media print passam a valer na cópia; o texto de cada <style> é reescrito
     (a biblioteca copia o texto original junto, que traria de volta as regras de tela) */
  function emularImpressao(doc) {
    var estilos = doc.querySelectorAll("style");
    for (var i = 0; i < estilos.length; i++) {
      var regras = null;
      try { regras = estilos[i].sheet && estilos[i].sheet.cssRules; } catch (e) {}
      if (!regras) continue;
      percorreRegras(regras);
      var css = "";
      for (var k = 0; k < regras.length; k++) css += regras[k].cssText + "\n";
      estilos[i].textContent = css;
    }
    var links = doc.querySelectorAll("link[media]");
    for (var j = 0; j < links.length; j++) links[j].setAttribute("media", trocaMidia(links[j].getAttribute("media")));
  }

  function dataBR(tipo, v) {
    var m;
    if (!v) return "";
    if (tipo === "date" && (m = v.match(/^(\d{4})-(\d{2})-(\d{2})$/))) return m[3] + "/" + m[2] + "/" + m[1];
    if (tipo === "datetime-local" && (m = v.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/))) return m[3] + "/" + m[2] + "/" + m[1] + ", " + m[4] + ":" + m[5];
    if (tipo === "month" && (m = v.match(/^(\d{4})-(\d{2})$/))) return m[2] + "/" + m[1];
    if (tipo === "time" && (m = v.match(/^(\d{2}):(\d{2})/))) return m[1] + ":" + m[2];
    return v;
  }

  var CAMPOS = ["box-sizing", "width", "height", "margin-top", "margin-right", "margin-bottom", "margin-left",
    "padding-top", "padding-right", "padding-bottom", "padding-left",
    "border-top-width", "border-right-width", "border-bottom-width", "border-left-width",
    "border-top-style", "border-right-style", "border-bottom-style", "border-left-style",
    "border-top-color", "border-right-color", "border-bottom-color", "border-left-color",
    "border-top-left-radius", "border-top-right-radius", "border-bottom-right-radius", "border-bottom-left-radius",
    "background-color", "color", "font-family", "font-size", "font-weight", "font-style", "line-height", "letter-spacing",
    "text-transform", "text-decoration-line", "text-indent", "vertical-align", "visibility", "opacity",
    "position", "top", "right", "bottom", "left", "z-index", "float", "order", "flex-grow", "flex-shrink", "flex-basis", "align-self"];
  var NAO_TEXTO = /^(checkbox|radio|hidden|button|submit|reset|image|file|range|color)$/;
  /* campos de formulário viram texto comum, com a mesma caixa, fonte e alinhamento */
  function camposComoTexto(doc) {
    var win = doc.defaultView;
    var els = [].slice.call(doc.querySelectorAll("input, textarea, select"));
    els.forEach(function (el) {
      var tag = el.tagName, tipo = String(el.type || "").toLowerCase();
      if (tag === "INPUT" && NAO_TEXTO.test(tipo)) return;
      var cs = win.getComputedStyle(el);
      if (cs.display === "none") return;
      var texto, cor = cs.color;
      if (tag === "SELECT") texto = el.selectedIndex >= 0 && el.options[el.selectedIndex] ? el.options[el.selectedIndex].text : "";
      else if (tag === "TEXTAREA") texto = el.value;
      else if (tipo === "password") texto = String(el.value).replace(/./g, "•");
      else texto = dataBR(tipo, el.value);
      if (!texto && el.placeholder) {
        texto = el.placeholder;
        var cp = "";
        try { cp = win.getComputedStyle(el, "::placeholder").color; } catch (e) {}
        cor = cp && cp !== cs.color ? cp : "#757575";
      }
      var d = doc.createElement("div");
      CAMPOS.forEach(function (p) { d.style.setProperty(p, cs.getPropertyValue(p)); });
      d.style.setProperty("color", cor);
      d.style.setProperty("overflow", "hidden");
      if (tag === "TEXTAREA") {
        d.style.setProperty("display", cs.display === "inline" ? "inline-block" : cs.display);
        d.style.setProperty("white-space", "pre-wrap");
        d.style.setProperty("overflow-wrap", "break-word");
        d.style.setProperty("word-break", "break-word");
        d.style.setProperty("text-align", cs.textAlign);
      } else {
        var ta = cs.textAlign;
        d.style.setProperty("display", /^(block|flex|grid|table|list-item)$/.test(cs.display) ? "flex" : "inline-flex");
        d.style.setProperty("align-items", "center");
        d.style.setProperty("justify-content", ta === "center" ? "center" : (ta === "right" || ta === "end") ? "flex-end" : "flex-start");
        d.style.setProperty("white-space", "pre");
      }
      d.textContent = texto;
      el.parentNode.replaceChild(d, el);
    });
  }

  /* tabela com bordas coladas: cada linha compartilhada é desenhada uma vez só (evita linha dupla) */
  function visivel(win, el) { return win.getComputedStyle(el).display !== "none"; }
  function temBorda(cs, lado) { return parseFloat(cs.getPropertyValue("border-" + lado + "-width")) > 0 && !/^(none|hidden)$/.test(cs.getPropertyValue("border-" + lado + "-style")); }
  function bordasSimples(doc) {
    var win = doc.defaultView, tabs = doc.querySelectorAll("table");
    for (var i = 0; i < tabs.length; i++) {
      var t = tabs[i];
      if (win.getComputedStyle(t).borderCollapse !== "collapse") continue;
      var acima = null;
      for (var r = 0; r < t.rows.length; r++) {
        var tr = t.rows[r];
        if (!visivel(win, tr)) continue;
        var esq = null, linha = [];
        for (var c = 0; c < tr.cells.length; c++) {
          var td = tr.cells[c];
          if (!visivel(win, td)) continue;
          var cima = acima && acima[linha.length];
          if (cima && temBorda(win.getComputedStyle(cima), "bottom")) td.style.setProperty("border-top-color", "transparent", "important");
          if (esq && temBorda(win.getComputedStyle(esq), "right")) td.style.setProperty("border-left-color", "transparent", "important");
          linha.push(td); esq = td;
        }
        acima = linha;
      }
    }
  }

  /* texto escondido com fonte tamanho zero (ex.: "(Assinatura / Carimbo)" do Termo) sai da cópia:
     no iPhone a biblioteca desenhava esse texto com outra fonte, no canto da folha */
  function tiraTextoInvisivel(doc) {
    var win = doc.defaultView, els = doc.body ? doc.body.getElementsByTagName("*") : [];
    for (var i = 0; i < els.length; i++) {
      if (parseFloat(win.getComputedStyle(els[i]).fontSize) >= 0.5) continue;
      for (var n = els[i].firstChild; n; ) {
        var prox = n.nextSibling;
        if (n.nodeType === 3) els[i].removeChild(n);
        n = prox;
      }
    }
  }

  /* reduz a imagem em etapas (metade por vez) com suavização alta: no iPhone a redução de uma vez só deixava o traço falhado */
  function reduzir(img, w, h) {
    var src = img, cw = img.naturalWidth, ch = img.naturalHeight;
    while (cw / 2 >= w && ch / 2 >= h) {
      cw = Math.round(cw / 2); ch = Math.round(ch / 2);
      var c = document.createElement("canvas"); c.width = cw; c.height = ch;
      var x = c.getContext("2d"); x.imageSmoothingEnabled = true; x.imageSmoothingQuality = "high";
      x.drawImage(src, 0, 0, cw, ch);
      src = c;
    }
    var f = document.createElement("canvas"); f.width = w; f.height = h;
    var fx = f.getContext("2d"); fx.imageSmoothingEnabled = true; fx.imageSmoothingQuality = "high";
    fx.drawImage(src, 0, 0, w, h);
    return f.toDataURL("image/png");
  }

  /* Termo: a assinatura fica numa caixa presa ao pé da linha, já no tamanho final e sem transformações
     (no iPhone a imagem posicionada pela regra de impressão saía da linha e empurrava o resto da folha) */
  function assinaturasNaLinha(doc) {
    var win = doc.defaultView, imgs = [].slice.call(doc.querySelectorAll(".campo-assinatura img"));
    imgs.forEach(function (img) {
      var src = img.currentSrc || img.src;
      if (!src || win.getComputedStyle(img).display === "none") return;
      var cs = win.getComputedStyle(img), abs = cs.position === "absolute";
      var campo = img.parentNode, largura = campo.clientWidth || parseFloat(win.getComputedStyle(campo).width) || 264;
      var alt = (abs && parseFloat(cs.height)) || 66, baixo = abs ? cs.bottom : "1px";
      var caixa = doc.createElement("div");
      caixa.style.cssText = "position:absolute !important;left:0 !important;right:0 !important;bottom:" + baixo + " !important;height:" + alt + "px !important;margin:0;padding:0;border:0;pointer-events:none";
      var iw = img.naturalWidth, ih = img.naturalHeight, feita = false;
      if (iw > 0 && ih > 0) {
        try {
          var k = Math.min(largura / iw, alt / ih), w = iw * k, h = ih * k;
          var nova = doc.createElement("img");
          nova.src = reduzir(img, Math.max(1, Math.round(w * ESCALA)), Math.max(1, Math.round(h * ESCALA)));
          nova.style.cssText = "display:block !important;position:absolute !important;bottom:0 !important;top:auto !important;left:50% !important;right:auto !important;" +
            "margin:0 0 0 " + (-w / 2) + "px !important;width:" + w + "px !important;height:" + h + "px !important;max-width:none !important;max-height:none !important;" +
            "transform:none !important;object-fit:fill !important;border:0;padding:0";
          caixa.appendChild(nova);
          feita = true;
        } catch (e) { console.error("[PDF] assinatura", e); }
      }
      if (!feita) caixa.style.cssText += ";background-image:url(\"" + src + "\");background-repeat:no-repeat;background-position:center bottom;background-size:contain";
      campo.style.setProperty("position", "relative", "important");
      campo.replaceChild(caixa, img);
    });
  }

  /* RAT e Caderno: a assinatura já vai reduzida para o tamanho em que aparece na folha
     (no iPhone a redução de uma vez só deixava o traço falhado) */
  function assinaturasNitidas(doc) {
    var imgs = [].slice.call(doc.querySelectorAll(".signature-pad img, .sig-line img"));
    imgs.forEach(function (img) {
      var iw = img.naturalWidth, ih = img.naturalHeight, r = img.getBoundingClientRect();
      if (!(iw > 0 && ih > 0 && r.width > 0 && r.height > 0)) return;
      try {
        var k = Math.min(r.width / iw, r.height / ih), w = iw * k, h = ih * k;
        var src = reduzir(img, Math.max(1, Math.round(w * ESCALA)), Math.max(1, Math.round(h * ESCALA)));
        img.removeAttribute("srcset");
        img.src = src;
        img.style.cssText += ";width:" + w + "px !important;height:" + h + "px !important;max-width:none !important;max-height:none !important;" +
          "object-fit:fill !important;transform:none !important";
      } catch (e) { console.error("[PDF] assinatura", e); }
    });
  }

  function prepararCopia(doc, cfg) {
    emularImpressao(doc);
    var st = doc.createElement("style");
    st.textContent = "html,body{background:#fff !important;height:auto !important;max-height:none !important;overflow:visible !important}" +
      "*{mix-blend-mode:normal !important}" + (cfg.css || "");
    (doc.head || doc.documentElement).appendChild(st);
    /* Termo de Entrega: linha sem descrição não vai para o PDF (como no GERAR PDF antigo) */
    var trs = doc.querySelectorAll(".tabela-itens tbody tr");
    for (var i = 0; i < trs.length; i++) {
      var inp = trs[i].querySelector("td:nth-child(2) input");
      if (inp && !String(inp.value || "").trim()) trs[i].style.setProperty("display", "none", "important");
    }
    bordasSimples(doc);
    assinaturasNaLinha(doc);
    assinaturasNitidas(doc);
    tiraTextoInvisivel(doc);
    camposComoTexto(doc);
  }

  function montarCopia(copia, W, H) {
    var fr = document.createElement("iframe");
    fr.setAttribute("aria-hidden", "true");
    fr.setAttribute("tabindex", "-1");
    fr.style.cssText = "position:fixed;left:-30000px;top:0;width:" + W + "px;height:" + H + "px;border:0;opacity:0;pointer-events:none";
    document.body.appendChild(fr);
    var d = fr.contentDocument;
    d.open(); d.write("<!DOCTYPE html><html><head></head><body></body></html>"); d.close();
    var tira = copia.querySelectorAll("script, iframe, #pdfc-ov");
    for (var i = 0; i < tira.length; i++) if (tira[i].parentNode) tira[i].parentNode.removeChild(tira[i]);
    var head = copia.querySelector("head");
    if (head) { var base = document.createElement("base"); base.href = document.baseURI; head.insertBefore(base, head.firstChild); }
    d.replaceChild(d.adoptNode(copia), d.documentElement);
    var esperas = [].slice.call(d.images).filter(function (im) { return !im.complete; }).map(function (im) {
      return new Promise(function (ok) { im.addEventListener("load", ok); im.addEventListener("error", ok); });
    });
    return Promise.race([Promise.all(esperas), new Promise(function (ok) { setTimeout(ok, 5000); })]).then(function () { return fr; });
  }

  /* ---------- imagem de cada folha ---------- */
  function lerBytes(blob) {
    if (blob.arrayBuffer) return blob.arrayBuffer().then(function (b) { return new Uint8Array(b); });
    return new Promise(function (ok, falha) {
      var fr = new FileReader();
      fr.onload = function () { ok(new Uint8Array(fr.result)); };
      fr.onerror = function () { falha(fr.error); };
      fr.readAsArrayBuffer(blob);
    });
  }
  function paraJPEG(cv) {
    return new Promise(function (ok, falha) {
      if (cv.toBlob) {
        cv.toBlob(function (b) { b ? lerBytes(b).then(ok, falha) : falha(new Error("jpeg")); }, "image/jpeg", QUALIDADE);
      } else {
        var bin = atob(cv.toDataURL("image/jpeg", QUALIDADE).split(",")[1]), u = new Uint8Array(bin.length);
        for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
        ok(u);
      }
    });
  }
  function capturar(h2c, pg, W, H, paisagem) {
    return h2c(pg, {
      scale: ESCALA,
      backgroundColor: "#ffffff",
      logging: false,
      useCORS: true,
      windowWidth: W,
      windowHeight: H,
      scrollX: 0,
      scrollY: 0
    }).then(function (cv) {
      return paraJPEG(cv).then(function (jpeg) {
        var p = { jpeg: jpeg, w: cv.width, h: cv.height, paisagem: paisagem };
        cv.width = cv.height = 0; /* libera memória */
        return p;
      });
    });
  }

  /* ---------- PDF (uma imagem JPEG por folha A4) ---------- */
  function num(n) { return (Math.round(n * 100) / 100).toString(); }
  function textoPDF(s) { /* UTF-16BE em hexadecimal: aceita acentos */
    var h = "<FEFF";
    for (var i = 0; i < s.length; i++) h += ("000" + s.charCodeAt(i).toString(16)).slice(-4).toUpperCase();
    return h + ">";
  }
  function montarPDF(paginas, titulo) {
    var partes = [], pos = 0, offs = [];
    function add(x) {
      var b;
      if (typeof x === "string") { b = new Uint8Array(x.length); for (var i = 0; i < x.length; i++) b[i] = x.charCodeAt(i) & 255; }
      else b = x;
      partes.push(b); pos += b.length;
    }
    function obj(n, corpo) { offs[n] = pos; add(n + " 0 obj\n"); corpo(); add("\nendobj\n"); }
    var n = paginas.length, total = 4 + 3 * n;
    add("%PDF-1.4\n"); add(new Uint8Array([37, 226, 227, 207, 211, 10]));
    var kids = [];
    for (var k = 0; k < n; k++) kids.push((4 + 3 * k) + " 0 R");
    obj(1, function () { add("<< /Type /Catalog /Pages 2 0 R >>"); });
    obj(2, function () { add("<< /Type /Pages /Kids [" + kids.join(" ") + "] /Count " + n + " >>"); });
    obj(3, function () {
      var d = new Date(), z = function (x) { return ("0" + x).slice(-2); };
      add("<< /Title " + textoPDF(titulo) + " /Producer (checklistvirtual) /CreationDate (D:" + d.getFullYear() + z(d.getMonth() + 1) + z(d.getDate()) + z(d.getHours()) + z(d.getMinutes()) + z(d.getSeconds()) + ") >>");
    });
    paginas.forEach(function (p, i) {
      var W = p.paisagem ? A4.h : A4.w, H = p.paisagem ? A4.w : A4.h;
      var s = W / p.w; if (p.h * s > H) s = H / p.h; /* largura da folha; se for mais alta, reduz para caber */
      var dw = p.w * s, dh = p.h * s, dx = (W - dw) / 2, dy = H - dh;
      var pg = 4 + 3 * i, ct = pg + 1, im = pg + 2;
      var conteudo = "q " + num(dw) + " 0 0 " + num(dh) + " " + num(dx) + " " + num(dy) + " cm /Im" + i + " Do Q";
      obj(pg, function () {
        add("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 " + num(W) + " " + num(H) + "] /Resources << /XObject << /Im" + i + " " + im + " 0 R >> /ProcSet [/PDF /ImageC] >> /Contents " + ct + " 0 R >>");
      });
      obj(ct, function () { add("<< /Length " + conteudo.length + " >>\nstream\n" + conteudo + "\nendstream"); });
      obj(im, function () {
        add("<< /Type /XObject /Subtype /Image /Width " + p.w + " /Height " + p.h + " /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length " + p.jpeg.length + " >>\nstream\n");
        add(p.jpeg);
        add("\nendstream");
      });
    });
    var xref = pos;
    add("xref\n0 " + total + "\n0000000000 65535 f \n");
    for (var j = 1; j < total; j++) add(("000000000" + offs[j]).slice(-10) + " 00000 n \n");
    add("trailer\n<< /Size " + total + " /Root 1 0 R /Info 3 0 R >>\nstartxref\n" + xref + "\n%%EOF\n");
    return new Blob(partes, { type: "application/pdf" });
  }

  function evento(nome) { try { window.dispatchEvent(new Event(nome)); } catch (e) { console.error("[PDF] " + nome, e); } }

  function gerarArquivo(cfg) {
    return carregarLib().then(function (h2c) {
      var copia, nome, paisagem = false;
      /* mesmos ajustes da impressão (hora do fim, texto do PDF, carimbo, nome...): prepara, copia e desfaz na hora */
      evento("beforeprint");
      try {
        nome = nomeArquivo(cfg.nome());
        var p0 = document.querySelector(cfg.seletor);
        paisagem = !!p0 && p0.offsetWidth > p0.offsetHeight;
        copia = document.documentElement.cloneNode(true);
      } finally {
        evento("afterprint");
      }
      var W = paisagem ? 1123 : 794, H = paisagem ? 794 : 1123, moldura = null;
      return montarCopia(copia, W, H).then(function (fr) {
        moldura = fr;
        var doc = fr.contentDocument;
        prepararCopia(doc, cfg);
        var pgs = [].slice.call(doc.querySelectorAll(cfg.seletor)), folhas = [], cadeia = Promise.resolve();
        if (!pgs.length) throw new Error("sem página");
        pgs.forEach(function (pg, i) {
          cadeia = cadeia.then(function () {
            if (pgs.length > 1) ui.detalhe("Página " + (i + 1) + " de " + pgs.length);
            return capturar(h2c, pg, W, H, paisagem);
          }).then(function (f) { folhas.push(f); });
        });
        return cadeia.then(function () {
          return new File([montarPDF(folhas, nome.replace(/\.pdf$/, ""))], nome, { type: "application/pdf", lastModified: Date.now() });
        });
      }).then(function (arq) {
        if (moldura && moldura.parentNode) moldura.parentNode.removeChild(moldura);
        return arq;
      }, function (e) {
        if (moldura && moldura.parentNode) moldura.parentNode.removeChild(moldura);
        throw e;
      });
    });
  }

  function baixar(arq) {
    var url = URL.createObjectURL(arq), a = document.createElement("a");
    a.href = url; a.download = arq.name; a.style.display = "none";
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(url); if (a.parentNode) a.parentNode.removeChild(a); }, 30000);
  }

  function compartilhar(arq) {
    return navigator.share({ files: [arq], title: arq.name.replace(/\.pdf$/i, "") }).then(function () {
      ui.fechar();
    }, function (e) {
      if (e && e.name === "AbortError") { ui.fechar(); return; } /* a pessoa fechou a tela de compartilhar */
      ui.pronto(arq); /* passou o tempo do toque: pede um toque para compartilhar */
    });
  }

  /* ---------- tela de aviso (tamanho confortável mesmo com a página reduzida no celular) ---------- */
  var ui = (function () {
    var ov = null, cx, tit, det, gira, bts, timer = 0;
    function cria() {
      if (ov) return;
      var st = document.createElement("style");
      st.textContent =
        "#pdfc-ov{position:fixed;left:0;top:0;width:100%;height:100%;z-index:2147483000;background:rgba(0,0,0,.6);display:none;font-family:Arial,Helvetica,sans-serif}" +
        "#pdfc-cx{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);background:#fff;color:#222;text-align:center;box-sizing:border-box;padding:1.1em 1em 1em;border-radius:.7em;box-shadow:0 .3em 1.5em rgba(0,0,0,.45);line-height:1.3}" +
        "#pdfc-gira{width:2.2em;height:2.2em;margin:0 auto .7em;border:.28em solid #e9e9e9;border-top-color:#e1251b;border-radius:50%;animation:pdfc-g .8s linear infinite;box-sizing:border-box}" +
        "@keyframes pdfc-g{to{transform:rotate(360deg)}}" +
        "#pdfc-tit{font-weight:bold;font-size:1.1em}" +
        "#pdfc-det{font-size:.8em;color:#555;margin-top:.35em;word-break:break-word}" +
        "#pdfc-bts{display:flex;flex-direction:column;gap:.55em;margin-top:.9em}" +
        "#pdfc-bts:empty{display:none}" +
        "#pdfc-bts button{border:0;border-radius:.45em;padding:.8em .5em;font:bold 1em Arial,Helvetica,sans-serif;color:#fff;cursor:pointer;text-transform:uppercase;width:100%}" +
        "@media print{#pdfc-ov{display:none !important}}";
      document.head.appendChild(st);
      ov = document.createElement("div");
      ov.id = "pdfc-ov";
      ov.innerHTML = '<div id="pdfc-cx"><div id="pdfc-gira"></div><div id="pdfc-tit"></div><div id="pdfc-det"></div><div id="pdfc-bts"></div></div>';
      document.body.appendChild(ov);
      cx = document.getElementById("pdfc-cx"); tit = document.getElementById("pdfc-tit");
      det = document.getElementById("pdfc-det"); gira = document.getElementById("pdfc-gira"); bts = document.getElementById("pdfc-bts");
      var vv = window.visualViewport;
      if (vv) { vv.addEventListener("resize", ajusta); vv.addEventListener("scroll", ajusta); }
      window.addEventListener("resize", ajusta);
      window.addEventListener("orientationchange", function () { setTimeout(ajusta, 300); });
    }
    function ajusta() {
      if (!ov || ov.style.display === "none") return;
      var vv = window.visualViewport;
      var vw = vv ? vv.width : window.innerWidth, vh = vv ? vv.height : window.innerHeight;
      var deitado = window.matchMedia && matchMedia("(orientation: landscape)").matches;
      var tela = (deitado ? Math.max(screen.width, screen.height) : Math.min(screen.width, screen.height)) || vw;
      var k = Math.max(1, vw / tela); /* px da página por px da tela */
      ov.style.left = (vv ? vv.offsetLeft : 0) + "px";
      ov.style.top = (vv ? vv.offsetTop : 0) + "px";
      ov.style.width = vw + "px";
      ov.style.height = vh + "px";
      cx.style.fontSize = (17 * k) + "px";
      cx.style.width = Math.min(vw * 0.88, 340 * k) + "px";
    }
    function mostra(t, d, comGiro, botoes) {
      cria();
      clearTimeout(timer);
      tit.textContent = t; det.textContent = d || "";
      gira.style.display = comGiro ? "" : "none";
      bts.innerHTML = "";
      (botoes || []).forEach(function (b) {
        var e = document.createElement("button");
        e.type = "button"; e.textContent = b[0]; e.style.background = b[1];
        e.onclick = function (ev) { ev.stopPropagation(); b[2](); };
        bts.appendChild(e);
      });
      ov.style.display = "block";
      ajusta();
    }
    function fechar() { clearTimeout(timer); if (ov) ov.style.display = "none"; }
    return {
      gerando: function () { mostra("Gerando o PDF…", "", true); },
      detalhe: function (d) { if (det) det.textContent = d; },
      fechar: fechar,
      pronto: function (arq) {
        mostra("PDF pronto", arq.name, false, [
          ["Compartilhar", "#e1251b", function () {
            navigator.share({ files: [arq], title: arq.name.replace(/\.pdf$/i, "") }).then(fechar, function (e) {
              if (e && e.name === "AbortError") return;
              baixar(arq); fechar();
            });
          }],
          ["Baixar", "#555", function () { baixar(arq); fechar(); }],
          ["Fechar", "#444", fechar]
        ]);
      },
      baixado: function (arq) {
        mostra("PDF baixado", arq.name, false, [["Fechar", "#444", fechar]]);
        timer = setTimeout(fechar, 2500);
      },
      erro: function (semLib) {
        mostra("Não consegui gerar o PDF",
          semLib ? "Confira a internet e tente de novo." : "Tente de novo. Se continuar, use Imprimir e salve como PDF.", false, [
          ["Tentar de novo", "#e1251b", function () { fechar(); window.print(); }],
          ["Imprimir", "#555", function () { fechar(); imprimirOriginal.call(window); }],
          ["Fechar", "#444", fechar]
        ]);
      }
    };
  })();

  /* ---------- novo window.print() ---------- */
  var ocupado = false;
  window.print = function () {
    var cfg = configApp();
    if (!cfg) return imprimirOriginal.apply(window, arguments);
    if (ocupado) return;
    ocupado = true;
    ui.gerando();
    gerarArquivo(cfg).then(function (arq) {
      if (COMPARTILHA) return compartilhar(arq);
      baixar(arq);
      ui.baixado(arq);
    }).catch(function (e) {
      console.error("[PDF]", e);
      ui.erro(e && e.message === "biblioteca");
    }).then(function () { ocupado = false; });
  };

  rotularBotao();
  function preCarregar() { setTimeout(function () { carregarLib().catch(function () {}); }, 800); }
  if (document.readyState === "complete") preCarregar(); else window.addEventListener("load", preCarregar);
})();
