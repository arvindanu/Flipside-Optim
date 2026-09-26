'use strict';

  // ---------- layout: the canvas always fills the whole screen ----------
  let W = 0, H = 0, K = 1, TOP = BAND, BOT = 0, PX = 0, CORR = 0, FLIGHT = 0.4;
  let G = G0, VMAX = V0, KICK = KICK0;
  let scx = 1, scy = 1, sx = 1, sy = 1;            // canvas scale, and css px per logical px
  let hudY = 24, hudL = 20, hudR = 60, insB = 0;
  const BOOST_BTN_ALIGN = 'right';   // where the boost button sits in the bottom wall: 'right' or 'center'
  let lastCssW = 0, lastCssH = 0;
  // Canvas resolution. Phones get a pixel budget, and the game lowers it by itself if a phone can't hold about 45 fps.
  const PIXEL_BUDGET = 1.1e6;   // canvas pixels we aim for
  const DPR_MIN = 0.8;          // never go blurrier than this
  let qual = 1, curDpr = 1, lastLayerKey = '', lite = false;
  function dprFor(q, cssW, cssH) {
    const dev = window.devicePixelRatio || 1;
    const base = Math.min(dev, 2, Math.max(1, Math.sqrt(PIXEL_BUDGET / (cssW * cssH))));
    return clamp(base * q, DPR_MIN, 2);
  }

  function readInsets() {
    let cs = null;
    try { cs = getComputedStyle(probe); } catch (e) { /* ignore */ }
    const n = (v) => parseFloat(v) || 0;
    return cs ? { t: n(cs.paddingTop), r: n(cs.paddingRight), b: n(cs.paddingBottom), l: n(cs.paddingLeft) }
              : { t: 0, r: 0, b: 0, l: 0 };
  }

  function layout() {
    const cssW = Math.max(1, window.innerWidth);
    const cssH = Math.max(1, window.innerHeight);
    lastCssW = cssW; lastCssH = cssH;
    const aspect = cssW / cssH;

    // Landscape keeps a 540-tall world and gets wider; portrait keeps a 540-wide world and gets taller.
    const nW = aspect >= 1 ? Math.round(540 * aspect) : 540;
    const nH = aspect >= 1 ? 540 : Math.round(540 / aspect);
    const big = W === 0 || Math.abs(nW - W) / W > 0.12 || Math.abs(nH - H) / H > 0.12;

    if (big) {
      W = nW; H = nH; K = W / 960;
      CORR = Math.min(H - 2 * BAND, CORR_MAX);
      TOP = Math.round((H - CORR) / 2);
      BOT = TOP + CORR;
      PX = Math.round(W * 0.2);
      // scale physics with corridor height so a flip always takes the same time
      const Vk = (CORR - S) / 410;
      G = G0 * Vk; VMAX = V0 * Vk; KICK = KICK0 * Vk;
      FLIGHT = Math.sqrt(2 * (CORR - S) / G);
    }

    const dpr = dprFor(qual, cssW, cssH);
    const cw = Math.round(cssW * dpr), ch = Math.round(cssH * dpr);
    if (canvas.width !== cw) canvas.width = cw;        // setting the size clears and re-allocates the canvas, so only when it really changed
    if (canvas.height !== ch) canvas.height = ch;
    curDpr = dpr;
    scx = canvas.width / W; scy = canvas.height / H;
    sx = cssW / W; sy = cssH / H;
    const layerKey = scx + '|' + scy + '|' + W + '|' + H + '|' + TOP + '|' + BOT;
    if (layerKey !== lastLayerKey) { lastLayerKey = layerKey; spriteGen++; spritePool.length = 0; }   // cached sprites no longer fit

    // HUD row and the pause button share one line near the top
    const ins = readInsets();
    insB = ins.b;
    const bandCss = TOP * sy;
    const btn = clamp(Math.round(bandCss * 0.75), 32, 44);
    const hudCssY = Math.min(bandCss / 2, Math.max(ins.t + btn / 2 + 8, 34 + btn / 2));
    hudY = hudCssY / sy;
    hudL = (ins.l + 16) / sx;
    hudR = (ins.r + 10 + btn + 14) / sx;
    pauseBtn.style.width = btn + 'px';
    pauseBtn.style.height = btn + 'px';
    pauseBtn.style.top = Math.round(hudCssY - btn / 2) + 'px';
    pauseBtn.style.right = Math.round(ins.r + 10) + 'px';

    // bottom row: best score on the left, boost button on the right
    // The bottom wall is otherwise empty, so the boost button fills it: as tall as the wall allows, with a little breathing room.
    const bandBotCss = (H - BOT) * sy;
    const room = Math.max(20, bandBotCss - ins.b);
    const pad = clamp(room * 0.09, 5, 12);
    let bb = clamp(Math.round(room - 2 * pad), 34, 118);
    if (bb > room - 1) bb = Math.max(24, Math.floor(room - 1));
    botY = BOT + room / 2 / sy;
    boostBtn.style.width = bb + 'px';
    boostBtn.style.height = bb + 'px';
    boostBtn.style.setProperty('--bb', bb + 'px');
    boostBtn.style.top = Math.round(BOT * sy + (room - bb) / 2) + 'px';
    if (BOOST_BTN_ALIGN === 'center') {
      boostBtn.style.right = 'auto';
      boostBtn.style.left = Math.round(cssW / 2 - bb / 2) + 'px';
    } else {
      boostBtn.style.left = 'auto';
      boostBtn.style.right = Math.round(ins.r + Math.max(10, pad)) + 'px';
    }

    return big;
  }

