'use strict';

  function drawSkyline() {
    const th = T, span = W + 420;
    for (let i = 0; i < 6; i++) {
      const seed = i * 71 + 19;
      const bw = (40 + (seed % 54)) * K;
      const bh = 46 + ((seed * 7) % Math.max(40, CORR * 0.34));
      const x = ((((i * span) / 6 - world * 0.05) % span) + span) % span - 210;
      const fromTop = i % 2 === 0;
      const y = fromTop ? TOP : BOT - bh;
      ctx.fillStyle = th.skyFar;
      ctx.fillRect(x, y, bw, bh);
      const nWin = 2 + (seed % 3);
      ctx.fillStyle = th.winFar;
      for (let k = 0; k < nWin; k++) {
        const wseed = seed * 13 + k * 29;
        const wx = x + 5 + (wseed % Math.max(1, bw - 8));
        const wy = y + 5 + ((wseed * 7) % Math.max(1, bh - 8));
        ctx.fillRect(wx, wy, 3, 3);
      }
    }
  }

  // Distant volcanoes for the Magma map: dark cones with a glowing crater, one row on the ceiling and one on the
  // floor (the corridor is symmetric, like the skyline). Deterministic, so the same silhouettes scroll past.
  function drawVolcanoes() {
    const th = T, span = W + 520, wK = Math.max(0.8, K);
    for (let i = 0; i < 5; i++) {
      const seed = i * 67 + 23;
      const bw = (170 + (seed % 90)) * wK;
      const bh = 70 + ((seed * 5) % Math.max(40, CORR * 0.3));
      const x = ((((i * span) / 5 - world * 0.05) % span) + span) % span - 260;
      const d = i % 2 === 0 ? 1 : -1;                  // 1 = hangs from the ceiling, -1 = rises from the floor
      const y0 = d === 1 ? TOP : BOT, tw = bw * 0.2, sx = x + (bw - tw) / 2, sy = y0 + d * bh;
      ctx.fillStyle = th.mountFar;
      ctx.beginPath();
      ctx.moveTo(x, y0); ctx.lineTo(sx, sy); ctx.lineTo(sx + tw, sy); ctx.lineTo(x + bw, y0);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = th.craterGlow;                   // a glowing summit, and a thin lava flow down one side
      ctx.fillRect(sx, d === 1 ? sy - 5 : sy, tw, 5);
      ctx.strokeStyle = th.craterGlow;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(sx + tw * 0.2, sy);
      ctx.lineTo(sx + (x - sx) * 0.3 + tw * 0.2, sy + (y0 - sy) * 0.42);
      ctx.stroke();
    }
  }

  // A few embers drifting up and back through the corridor. Positions come from the scroll, so nothing is random.
  function drawEmbers() {
    const span = W + 80;
    ctx.fillStyle = T.ember;
    for (let i = 0; i < 16; i++) {
      const x = ((((i * 137) % span) - world * (0.18 + (i % 4) * 0.05)) % span + span) % span - 20;
      const y = BOT - ((world * (0.22 + (i % 3) * 0.08) + i * 61) % CORR);
      ctx.globalAlpha = 0.25 + 0.1 * ((i * 7) % 5);
      const sz = 2 + (i % 3);
      ctx.fillRect(x, y, sz, sz);
    }
    ctx.globalAlpha = 1;
  }

  // Distant glacier peaks for the Glaciers map: white ridges with a cool shaded face, one row on the ceiling and one
  // on the floor (the corridor is symmetric, like the skyline). Deterministic, so the same peaks scroll past.
  function drawPeaks() {
    const th = T, span = W + 520, wK = Math.max(0.8, K);
    for (let i = 0; i < 5; i++) {
      const seed = i * 61 + 17;
      const bw = (210 + (seed % 100)) * wK;
      const bh = 80 + ((seed * 5) % Math.max(40, CORR * 0.32));
      const x = ((((i * span) / 5 - world * 0.05) % span) + span) % span - 260;
      const d = i % 2 === 0 ? 1 : -1;                  // 1 = hangs from the ceiling, -1 = rises from the floor
      const y0 = d === 1 ? TOP : BOT, px = x + bw * (0.36 + (seed % 20) / 100), py = y0 + d * bh;
      ctx.fillStyle = th.peakShade;
      ctx.beginPath();
      ctx.moveTo(x, y0); ctx.lineTo(px, py); ctx.lineTo(x + bw, y0);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = th.peakLight;                    // the sunlit face
      ctx.beginPath();
      ctx.moveTo(x, y0); ctx.lineTo(px, py); ctx.lineTo(px + bw * 0.1, y0);
      ctx.closePath(); ctx.fill();
    }
  }

  // Distant reef mounds for the Ocean map: rounded silhouettes with a lit crown, one row on the ceiling and one on
  // the floor (the corridor is symmetric, like the skyline and the glacier peaks). Deterministic, so the same
  // shapes scroll past.
  function drawReef() {
    const th = T, span = W + 480, wK = Math.max(0.8, K);
    for (let i = 0; i < 5; i++) {
      const seed = i * 53 + 11;
      const bw = (150 + (seed % 90)) * wK;
      const bh = 46 + ((seed * 5) % Math.max(30, CORR * 0.22));
      const x = ((((i * span) / 5 - world * 0.05) % span) + span) % span - 240;
      const d = i % 2 === 0 ? 1 : -1;                  // 1 = hangs from the ceiling, -1 = rises from the floor
      const y0 = d === 1 ? TOP : BOT, cxp = x + bw * (0.4 + (seed % 20) / 100), yp = y0 + d * bh;
      ctx.fillStyle = th.sandFar;
      ctx.beginPath();
      ctx.moveTo(x, y0);
      ctx.quadraticCurveTo(cxp, yp, x + bw, y0);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = th.hill;
      ctx.beginPath();
      ctx.moveTo(x + bw * 0.14, y0);
      ctx.quadraticCurveTo(cxp, yp + d * 6, x + bw * 0.42, y0);
      ctx.closePath(); ctx.fill();
    }
  }

  // Distant islets for the Lighthouse map: low dark humps breaking the horizon with a faint moonlit rim, one row
  // on the ceiling and one on the floor (the corridor is symmetric, like the skyline and the reef). Deterministic,
  // so the same shapes scroll past every time.
  function drawIslands() {
    const th = T, span = W + 480, wK = Math.max(0.8, K);
    for (let i = 0; i < 5; i++) {
      const seed = i * 59 + 13;
      const bw = (140 + (seed % 90)) * wK;
      const bh = 34 + ((seed * 5) % Math.max(24, CORR * 0.16));
      const x = ((((i * span) / 5 - world * 0.05) % span) + span) % span - 240;
      const d = i % 2 === 0 ? 1 : -1;                  // 1 = hangs from the ceiling, -1 = rises from the floor
      const y0 = d === 1 ? TOP : BOT, cxp = x + bw * (0.4 + (seed % 20) / 100), yp = y0 + d * bh;
      ctx.fillStyle = th.islandFar;
      ctx.beginPath();
      ctx.moveTo(x, y0);
      ctx.quadraticCurveTo(cxp, yp, x + bw, y0);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = th.hill;
      ctx.beginPath();
      ctx.moveTo(x + bw * 0.18, y0);
      ctx.quadraticCurveTo(cxp, yp + d * 5, x + bw * 0.46, y0);
      ctx.closePath(); ctx.fill();
    }
  }

  // Bubbles rising through the whole corridor, giving the Ocean map its underwater feel even far from the sprite.
  // Positions come from the scroll and the clock (like the snow), so nothing is random and nothing is allocated
  // per frame. Fewer bubbles in low-power mode, and they hold still with reduced motion.
  function drawOceanBubbles() {
    const n = lite ? 14 : 34, span = W + 60;
    ctx.fillStyle = T.bubble;
    for (let pass = 0; pass < 2; pass++) {
      ctx.globalAlpha = pass ? 0.85 : 0.4;
      ctx.beginPath();   // one path per pass (each bubble gets its own moveTo, same idea as the snow/dot grid)
      for (let i = pass; i < n; i += 2) {
        const r = pass ? 1.8 + (i % 3) * 0.8 : 1 + (i % 3) * 0.5;
        const sway = reduce ? 0 : Math.sin(clock * 1.4 + i * 1.7) * (3 + (i % 4));
        const x = ((((i * 83) % span) - world * (0.12 + (i % 5) * 0.03) + sway) % span + span) % span - 30;
        const rise = 24 + (i % 4) * 9;
        const y = BOT - ((((i * 71) + (reduce ? 0 : clock * rise)) % CORR) + CORR) % CORR;
        ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, Math.PI * 2);
      }
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // Stars scattered through the whole corridor for the Lighthouse map: fixed points that twinkle smoothly (a sine,
  // never a strobe) and drift back with the scroll, far slower than anything in the foreground (like the distant
  // hill blobs). Nothing is random and nothing is allocated per frame. Fewer stars in low-power mode, and they
  // hold still with reduced motion.
  function drawStars() {
    const n = lite ? 18 : 46, span = W + 40;
    for (let i = 0; i < n; i++) {
      const x = ((((i * 101) % span) - world * (0.05 + (i % 5) * 0.015)) % span + span) % span - 20;
      const y = TOP + ((i * 67) % Math.max(1, CORR));
      const tw = reduce ? 0.7 : 0.45 + 0.55 * Math.sin(clock * (1.4 + (i % 4) * 0.5) + i * 2.3);
      ctx.globalAlpha = 0.25 + 0.6 * tw;
      ctx.fillStyle = T.star;
      const sz = 1 + (i % 3) * 0.7;
      ctx.fillRect(x, y, sz, sz);
    }
    ctx.globalAlpha = 1;
  }

  // Soft mist banks drifting through the corridor for the Lighthouse map: a handful of low-alpha wisps that sway
  // sideways and hold still with reduced motion. Purely decorative and layered thin, so it reads as haze rather
  // than fog blotting out the obstacles. Skipped entirely in low-power mode, like the ocean's caustics.
  function drawMist() {
    if (lite) return;
    const n = 6, span = W + 300;
    ctx.fillStyle = T.mist;
    for (let i = 0; i < n; i++) {
      const x = ((((i * span) / n - world * (0.1 + (i % 3) * 0.03)) % span) + span) % span - 150;
      const y = TOP + 40 + ((i * 97) % Math.max(40, CORR - 80));
      const rw = 130 + (i % 3) * 40, rh = 22 + (i % 2) * 10;
      const drift = reduce ? 0 : Math.sin(clock * 0.35 + i * 1.9) * 14;
      ctx.globalAlpha = 0.05 + 0.02 * (i % 3);
      ctx.beginPath();
      ctx.ellipse(x + drift, y, rw, rh, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // Faint shafts of light slanting down through the water on the Ocean map. Purely decorative and very subtle.
  function drawCaustics() {
    if (lite) return;
    const span = W + 200;
    ctx.fillStyle = T.ray;
    for (let i = 0; i < 4; i++) {
      const x = ((((i * span) / 4 - world * 0.15) % span) + span) % span - 60;
      const rw = 46 + (i % 2) * 20;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(x, TOP); ctx.lineTo(x + rw, TOP); ctx.lineTo(x + rw * 0.4, BOT); ctx.lineTo(x - rw * 0.4, BOT);
      ctx.closePath(); ctx.fill();
      ctx.restore();
    }
  }

  // Snow drifting through the corridor: it falls and sways with the clock and slides back with the scroll. Nothing
  // is random and nothing is allocated per frame; two fills (far flakes, then near ones) draw all of it. Fewer
  // flakes in low-power mode, and it holds still if the player asked for reduced motion.
  function drawSnow() {
    const n = lite ? 16 : 56, span = W + 60;
    ctx.fillStyle = T.snow;
    for (let pass = 0; pass < 2; pass++) {
      ctx.globalAlpha = pass ? 0.95 : 0.6;
      ctx.beginPath();
      for (let i = pass; i < n; i += 2) {
        const r = pass ? 2.5 + (i % 3) * 0.8 : 1.4 + (i % 3) * 0.5;
        const sway = reduce ? 0 : Math.sin(clock * 0.9 + i) * 9;
        const x = ((((i * 89) % span) - world * ((pass ? 0.5 : 0.25) + (i % 5) * 0.03) + sway) % span + span) % span - 30;
        const y = TOP + ((((i * 53) + (reduce ? 0 : clock * (16 + (i % 4) * 7))) % CORR) + CORR) % CORR;
        ctx.moveTo(x + r, y);
        ctx.arc(x, y, r, 0, Math.PI * 2);
      }
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // A cheap deterministic hash to a number in [0, 1). The Tesla effects use it instead of Math.random, so a given coil
  // and time slot always give the same arc: nothing reshuffles between frames and nothing is allocated.
  function hash01(n) {
    n = Math.imul(n ^ (n >>> 15), 0x2c1b3c6d);
    n = Math.imul(n ^ (n >>> 12), 0x297a2d39);
    return ((n ^ (n >>> 15)) >>> 0) / 4294967296;
  }

  // One jagged arc snapping out of a coil's terminal ball: a glow stroke under a thin white-hot core, and a short fork.
  function coilArc(bx, by, dir, br, s, sc) {
    const ang = (hash01(s) - 0.5) * 2.4;                       // radians off the tip's direction, either way
    const dx = Math.sin(ang), dy = dir * Math.cos(ang);
    const len = (28 + hash01(s + 1) * 46) * sc, seg = 7;
    let jx = 0, jy = 0;
    ctx.beginPath();
    ctx.moveTo(bx + dx * br, by + dy * br);
    for (let k = 1; k <= seg; k++) {
      const f = k / seg, j = (hash01(s + 10 + k) - 0.5) * 18 * sc * Math.sin(Math.PI * f);
      const x = bx + dx * (br + len * f) - dy * j, y = by + dy * (br + len * f) + dx * j;
      ctx.lineTo(x, y);
      if (k === 3) { jx = x; jy = y; }
    }
    const fa = ang + (hash01(s + 4) < 0.5 ? -0.9 : 0.9), fx = Math.sin(fa), fy = dir * Math.cos(fa), fl = len * 0.42;
    ctx.moveTo(jx, jy);
    ctx.lineTo(jx + fx * fl * 0.5 + (hash01(s + 5) - 0.5) * 8 * sc, jy + fy * fl * 0.5 + (hash01(s + 6) - 0.5) * 8 * sc);
    ctx.lineTo(jx + fx * fl, jy + fy * fl);
    ctx.strokeStyle = T.arc; ctx.lineWidth = 5; ctx.globalAlpha = 0.28; ctx.stroke();
    ctx.strokeStyle = T.arcCore; ctx.lineWidth = 1.6; ctx.globalAlpha = 1; ctx.stroke();
  }

  // Live lightning for the Tesla map, drawn over the cached coil sprites: a pulsing glow round each coil's ring and
  // terminal ball, and jagged arcs that snap out of the ball about 13 times a second (re-rolled from a hash of the
  // coil's own seed and the time slot). The arcs are decoration: the hitbox is the coil itself. With reduced motion
  // only the steady glow is drawn, and low-power mode draws fewer arcs and skips the ring glow.
  function drawCoilFx() {
    const sc = Math.max(0.8, K);
    for (const o of obstacles) {
      const L = o.look;
      if (!L || L.kind !== 'coil' || o.x > W + 80 || o.x + o.w < -80) continue;
      const fl = o.side === 'floor', dir = fl ? -1 : 1;
      const Y = (t) => (fl ? BOT - t : TOP + t);              // height above the wall -> screen y
      const cxs = o.x + L.cx, by = Y(L.ballMid);
      const pulse = reduce ? 0.85 : 0.75 + 0.25 * Math.sin(clock * 6 + L.seed);
      ctx.fillStyle = T.arc;
      ctx.globalAlpha = 0.07 * pulse; circle(cxs, by, L.br * 3.6);
      ctx.globalAlpha = 0.11 * pulse; circle(cxs, by, L.br * 2.4);
      ctx.globalAlpha = 0.2 * pulse; circle(cxs, by, L.br * 1.5);
      if (!lite) {
        ctx.fillStyle = T.violet;
        ctx.globalAlpha = 0.08 * pulse;
        ctx.beginPath(); ctx.ellipse(cxs, Y(L.torMid), L.hwT * 1.35, L.tt * 1.6, 0, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 0.1 * pulse;
        ctx.beginPath(); ctx.ellipse(cxs, Y(L.torMid), L.hwT * 1.1, L.tt * 0.95, 0, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
      if (reduce) continue;
      const s = L.seed * 31 + Math.floor(clock * 13) * 7919;
      if (hash01(s) < 0.72) coilArc(cxs, by, dir, L.br, s + 1, sc);
      if (!lite && hash01(s + 5) < 0.32) coilArc(cxs, by, dir, L.br, s + 9, sc);
      ctx.fillStyle = T.arcCore;                              // a few sparks flung off the terminal
      for (let k = 0; k < 3; k++) {
        const a = hash01(s + 30 + k) * Math.PI * 2, r = L.br * (1.4 + hash01(s + 40 + k) * 2.2);
        ctx.globalAlpha = 0.9;
        ctx.fillRect(cxs + Math.cos(a) * r - 1, by + Math.sin(a) * r - 1, 2, 2);
      }
      ctx.globalAlpha = 1;
    }
  }

  // Rotating light for the Lighthouse map, drawn over the cached tower sprites: a slow sweeping beam from each lamp
  // room, plus a soft halo. The sweep is decoration only, never the hitbox (that's the tower's own silhouette).
  // With reduced motion the beam holds at a fixed heading instead of turning, so the lamp still reads as lit; the
  // full sweep still passes behind the corridor walls at some angles, same as any obstacle would. Low-power mode
  // skips the second, brighter layer of the halo and beam.
  function drawLighthouseBeam() {
    const period = 5.2, len = Math.hypot(W, CORR) * 0.55;
    for (const o of obstacles) {
      const L = o.look;
      if (!L || L.kind !== 'lighthouse' || o.x > W + 200 || o.x + o.w < -200) continue;
      const fl = o.side === 'floor';
      const Y = (t) => (fl ? BOT - t : TOP + t);              // height above the wall -> screen y
      const bx = o.x + L.cx, by = Y(L.lampMid);
      const phase = (L.seed % 1000) * 0.00628;
      const ang = reduce ? phase : (clock * (Math.PI * 2 / period) + phase) % (Math.PI * 2);
      ctx.fillStyle = T.beamCore;
      ctx.globalAlpha = 0.14; circle(bx, by, L.lampHW * 2.8);
      if (!lite) { ctx.globalAlpha = 0.08; circle(bx, by, L.lampHW * 4.6); }
      const wedge = (a, spread) => {
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.lineTo(bx + Math.cos(a - spread) * len, by + Math.sin(a - spread) * len);
        ctx.lineTo(bx + Math.cos(a + spread) * len, by + Math.sin(a + spread) * len);
        ctx.closePath(); ctx.fill();
      };
      ctx.fillStyle = T.beam;
      ctx.globalAlpha = 0.09;
      wedge(ang, 0.2); wedge(ang + Math.PI, 0.2);
      if (!lite) {
        ctx.fillStyle = T.beamCore;
        ctx.globalAlpha = 0.15;
        wedge(ang, 0.05); wedge(ang + Math.PI, 0.05);
      }
      ctx.globalAlpha = 1;
    }
  }

  // The Tesla sky. A thin charged rail runs along each wall with pulses of current riding it (they scroll with the
  // world), and every few seconds a dim forked bolt flickers out from one wall with the faintest brightening of the
  // sky. Two quick flickers about every 3.4 s is far under the three-flashes-a-second limit for photosensitive
  // players, the brightening is tiny, and with reduced motion there is no lightning at all.
  function drawStorm() {
    const span = W + 240;
    ctx.fillStyle = T.arc;
    if (!lite) {                                               // charged air: a stepped glow fading in from each rail
      ctx.globalAlpha = 0.045;
      for (let k = 1; k <= 4; k++) { ctx.fillRect(0, TOP, W, k * 9); ctx.fillRect(0, BOT - k * 9, W, k * 9); }
    }
    ctx.globalAlpha = 0.2;
    ctx.fillRect(0, TOP, W, 2);
    ctx.fillRect(0, BOT - 2, W, 2);
    ctx.globalAlpha = 0.55;
    for (let i = 0; i < 3; i++) {
      ctx.fillRect(((((i * span) / 3 - world * 0.9) % span) + span) % span - 120, TOP, 70, 2);
      ctx.fillRect(((((i * span) / 3 + span / 6 - world * 0.7) % span) + span) % span - 120, BOT - 2, 70, 2);
    }
    ctx.globalAlpha = 1;
    if (reduce) return;
    const period = 3.4, slot = Math.floor(clock / period), ph = clock - slot * period;
    const f = ph < 0.05 ? 1 : ph < 0.1 ? 0.2 : ph < 0.17 ? 0.8 : ph < 0.32 ? 0.8 * (1 - (ph - 0.17) / 0.15) : 0;
    if (f <= 0) return;
    const s = slot * 977 + 13, fromTop = slot % 2 === 0, dir = fromTop ? 1 : -1, sc = Math.max(0.8, K);
    ctx.globalAlpha = 0.06 * f;
    ctx.fillRect(0, TOP, W, CORR);                             // the faint brightening of the sky
    let x = W * (0.12 + 0.76 * hash01(s)), y = fromTop ? TOP : BOT, fx = x, fy = y, gx = x, gy = y;
    const len = CORR * (0.5 + 0.25 * hash01(s + 1)), seg = 10;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let k = 1; k <= seg; k++) {
      x += (hash01(s + 20 + k) - 0.5) * 38 * sc;
      y += (dir * len) / seg;
      ctx.lineTo(x, y);
      if (k === 4) { fx = x; fy = y; }
      if (k === 7) { gx = x; gy = y; }
    }
    ctx.moveTo(fx, fy);
    ctx.lineTo(fx + (hash01(s + 3) < 0.5 ? -1 : 1) * len * 0.24, fy + dir * len * 0.22);
    ctx.moveTo(gx, gy);
    ctx.lineTo(gx + (hash01(s + 4) < 0.5 ? -1 : 1) * len * 0.18, gy + dir * len * 0.16);
    ctx.strokeStyle = T.arc; ctx.lineWidth = 7; ctx.globalAlpha = 0.26 * f; ctx.stroke();
    ctx.strokeStyle = T.arcCore; ctx.lineWidth = 1.8; ctx.globalAlpha = 0.85 * f; ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // Sparks of static drifting through the corridor: they rise slowly with the clock, slide back with the scroll and
  // twinkle smoothly (a sine, never a strobe). Fewer in low-power mode; they hold still with reduced motion.
  function drawSparks() {
    const n = lite ? 12 : 40, span = W + 40;
    for (let i = 0; i < n; i++) {
      const x = ((((i * 97) % span) - world * (0.12 + (i % 5) * 0.04)) % span + span) % span - 20;
      const y = TOP + ((((i * 61) + (reduce ? 0 : clock * (5 + (i % 4) * 3))) % CORR) + CORR) % CORR;
      const tw = reduce ? 0.7 : 0.55 + 0.45 * Math.sin(clock * (2 + (i % 4)) + i * 1.7);
      ctx.globalAlpha = 0.25 + 0.55 * tw;
      ctx.fillStyle = i % 3 === 0 ? T.violet : i % 3 === 1 ? T.arc : T.arcCore;
      const sz = 2 + (i % 3) * 0.9;
      ctx.fillRect(x, y, sz, sz);
    }
    ctx.globalAlpha = 1;
  }

