'use strict';

  // ---------- cached sprites ----------
  // Every tree or rock never changes once made, so it is painted once and then copied to the screen each frame.
  // (Measured: copying three cached sprites is 3 to 9 times cheaper than repainting their shapes.)
  const mkCanvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  let spriteGen = 0, spritePool = [];

  // One reusable off-screen canvas per tree/rock currently on screen, all the same size, recycled as they scroll away.
  function spriteFor(o) {
    if (o.sprite && o.spriteGen === spriteGen) return o.sprite;
    const wK = Math.max(0.8, K);
    const cw = Math.ceil((98 * wK + 12) * scx), ch = Math.ceil((CORR * 0.68 + 12) * scy);
    let cv = spritePool.pop();
    if (!cv) cv = mkCanvas(cw, ch);
    const g = cv.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, cv.width, cv.height);
    g.setTransform(scx, 0, 0, scy, 0, 0);
    paintObstacle(g, { x: 0, w: o.w, h: o.h, side: o.side, look: o.look }, 0, o.h, T);
    o.sprite = cv; o.spriteGen = spriteGen;
    return cv;
  }
  function releaseSprite(o) {
    if (o.sprite && o.spriteGen === spriteGen && spritePool.length < 16) spritePool.push(o.sprite);
    o.sprite = null;
  }

  // ---------- drawing ----------
  // Cached font strings and the SOUL label's measured width: real work only when the screen scale changes.
  let fontCacheGen = -1;
  let fontHudLab = '', fontHudNum = '', fontSoulLab = '', fontSoulNum = '', fontHint = '', fontFloatBig = '', fontFloatSmall = '', soulLabelW = 0;
  function refreshFontCache() {
    if (fontCacheGen === spriteGen) return;
    fontCacheGen = spriteGen;
    const u = 1 / sy;
    fontHudLab = '600 ' + Math.round(17 * u) + 'px ' + FONT;
    fontHudNum = '800 ' + Math.round(20 * u) + 'px ' + FONT;
    fontSoulLab = '800 ' + Math.round(12 * u) + 'px ' + FONT;
    fontSoulNum = '800 ' + Math.round(24 * u) + 'px ' + FONT;
    fontHint = '600 ' + Math.round(18 / sy) + 'px ' + FONT;
    fontFloatBig = '800 ' + Math.round(22 / sy) + 'px ' + FONT;
    fontFloatSmall = '800 ' + Math.round(18 / sy) + 'px ' + FONT;
    ctx.font = fontSoulLab;
    soulLabelW = ctx.measureText('SOUL').width;
  }
  // setLineDash() copies whatever array it is given, so one shared array can be reused every frame
  // instead of allocating a fresh [26, 18] / [9, 9] / [] literal each time these run.
  const DASH_WALL = [26, 18], DASH_MEGA = [9, 9], DASH_NONE = [];
  function rr(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function circle(x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }

  // A night skyline in place of the soft hill-blobs the other maps use. Anchored to both walls (like real
  // buildings), since this game's floor and ceiling are symmetric. Deterministic (no Math.random): the same
  // pattern scrolls past every time, it does not reshuffle every frame. Plain fillRects only, no clipping or
  // paths, so this costs less per frame than the 4 blurred hill circles it replaces.
