/* Assinatura suave e precisa (Termo de Entrega, Caderno de Testes e RAT).
   Intercepta toque/mouse nos canvas de assinatura: traço em curva suavizada, resolução alta
   (nitidez em telas densas / zoom) e espessura proporcional. Não altera o resto dos apps. */
(function () {
  if (window.__sigSuave) return;
  window.__sigSuave = true;
  var IDS = { canvas: 1, "modal-canvas": 1, canvasModal: 1 };

  function alvo(e) {
    var t = e.target;
    return t && t.tagName === "CANVAS" && IDS[t.id] ? t : null;
  }

  /* garante resolução alta preservando o que já foi desenhado; devolve a espessura-base (px CSS) */
  function preparar(cv) {
    var r = cv.getBoundingClientRect();
    if (!r.width || !r.height) return null;
    var ctx = cv.getContext("2d");
    if (cv.__w !== cv.width || cv.__h !== cv.height) {
      /* o app (re)definiu o tamanho do canvas: lê a espessura que ele escolheu */
      var lw = ctx.lineWidth;
      cv.__base = lw && lw > 0 ? lw : 3;
      /* resolução 2x, mas com teto de área (~3,5 Mpx) para não pesar/atrasar em telas grandes (celular em pé) */
      var f = Math.min(Math.max(window.devicePixelRatio || 1, 2), Math.sqrt(3500000 / (r.width * r.height)));
      var alvoW = Math.round(r.width * f);
      if (cv.width < alvoW * 0.9 || cv.width > alvoW * 1.15) {
        var tmp = document.createElement("canvas");
        tmp.width = cv.width; tmp.height = cv.height;
        tmp.getContext("2d").drawImage(cv, 0, 0);
        var k = alvoW / cv.width;
        cv.width = alvoW;
        cv.height = Math.round(cv.height * k);
        ctx = cv.getContext("2d");
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.drawImage(tmp, 0, 0, tmp.width, tmp.height, 0, 0, cv.width, cv.height);
      }
      cv.__w = cv.width; cv.__h = cv.height;
    }
    return { ctx: ctx, r: r, sx: cv.width / r.width, sy: cv.height / r.height, fino: emPe() };
  }

  var st = null; /* traço em andamento */

  /* celular em pé: área estreita, então traço mais fino para ficar preciso */
  function emPe() {
    return Math.min(screen.width || 9999, screen.height || 9999) < 600 &&
           window.matchMedia("(pointer:coarse)").matches &&
           window.matchMedia("(orientation:portrait)").matches;
  }

  function pos(cv, info, cx, cy) {
    return { x: (cx - info.r.left) * info.sx, y: (cy - info.r.top) * info.sy };
  }
  function estilo(cv, info) {
    var c = info.ctx;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.strokeStyle = "blue"; c.fillStyle = "blue";
    c.lineCap = "round"; c.lineJoin = "round";
    c.lineWidth = (cv.__base || 3) * info.sx * (info.fino ? 0.7 : 1);
  }
  function ponto(p) {
    var c = st.info.ctx;
    estilo(st.cv, st.info);
    c.beginPath();
    c.arc(p.x, p.y, c.lineWidth / 2, 0, Math.PI * 2);
    c.fill();
  }
  function inicio(cv, cx, cy, id) {
    var info = preparar(cv);
    if (!info) return false;
    st = { cv: cv, info: info, id: id, pts: [pos(cv, info, cx, cy)], mid: null };
    ponto(st.pts[0]);
    return true;
  }
  function mover(cx, cy) {
    if (!st) return;
    var info = st.info;
    info.r = st.cv.getBoundingClientRect(); /* acompanha rolagem/zoom */
    var p = pos(st.cv, info, cx, cy), q = st.pts[st.pts.length - 1];
    var dx = p.x - q.x, dy = p.y - q.y;
    if (dx * dx + dy * dy < 1.5) return; /* ignora tremor mínimo */
    st.pts.push(p);
    var n = st.pts.length;
    var c = info.ctx;
    estilo(st.cv, info);
    c.beginPath();
    if (n === 2) {
      var m = { x: (q.x + p.x) / 2, y: (q.y + p.y) / 2 };
      c.moveTo(q.x, q.y); c.lineTo(m.x, m.y);
      st.mid = m;
    } else {
      var m2 = { x: (q.x + p.x) / 2, y: (q.y + p.y) / 2 };
      c.moveTo(st.mid.x, st.mid.y);
      c.quadraticCurveTo(q.x, q.y, m2.x, m2.y);
      st.mid = m2;
    }
    c.stroke();
  }
  function fim() {
    if (!st) return;
    var c = st.info.ctx, n = st.pts.length;
    if (n > 1 && st.mid) {
      var p = st.pts[n - 1];
      estilo(st.cv, st.info);
      c.beginPath(); c.moveTo(st.mid.x, st.mid.y); c.lineTo(p.x, p.y); c.stroke();
    }
    c.beginPath();
    st = null;
  }

  function parar(e) { e.stopImmediatePropagation(); e.stopPropagation(); if (e.cancelable) e.preventDefault(); }
  var W = window, O = { capture: true, passive: false };

  W.addEventListener("touchstart", function (e) {
    var cv = alvo(e); if (!cv) return;
    parar(e);
    if (st) fim();
    var t = e.changedTouches[0];
    inicio(cv, t.clientX, t.clientY, t.identifier);
  }, O);
  W.addEventListener("touchmove", function (e) {
    if (!st || !alvo(e)) { if (st && e.cancelable) e.preventDefault(); return; }
    parar(e);
    for (var i = 0; i < e.changedTouches.length; i++) {
      var t = e.changedTouches[i];
      if (t.identifier === st.id) mover(t.clientX, t.clientY);
    }
  }, O);
  var fimT = function (e) {
    if (!st) return;
    if (alvo(e)) parar(e);
    for (var i = 0; i < e.changedTouches.length; i++) if (e.changedTouches[i].identifier === st.id) { fim(); break; }
  };
  W.addEventListener("touchend", fimT, O);
  W.addEventListener("touchcancel", fimT, O);

  /* mouse (computador) */
  W.addEventListener("mousedown", function (e) {
    var cv = alvo(e); if (!cv || e.button !== 0) return;
    parar(e);
    inicio(cv, e.clientX, e.clientY, "m");
  }, O);
  W.addEventListener("mousemove", function (e) {
    if (!st || st.id !== "m") return;
    if (alvo(e)) parar(e);
    mover(e.clientX, e.clientY);
  }, O);
  var fimM = function (e) { if (st && st.id === "m") { if (alvo(e)) parar(e); fim(); } };
  W.addEventListener("mouseup", fimM, O);
  document.addEventListener("mouseleave", fimM, true);
})();
