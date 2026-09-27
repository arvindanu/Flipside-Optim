'use strict';

  // ----- drawing the shapes -----
  function pathPoly(g, P, pts) {
    g.beginPath();
    for (let i = 0; i < pts.length; i++) {
      const q = P(pts[i][0], pts[i][1]);
      if (i) g.lineTo(q[0], q[1]); else g.moveTo(q[0], q[1]);
    }
    g.closePath();
  }
  function fillPoly(g, P, pts, color) { g.fillStyle = color; pathPoly(g, P, pts); g.fill(); }

  function paintPine(g, o, P, th, flat) {
    const L = o.look, cx = L.cx;
    fillPoly(g, P, [[cx - L.trunkHW, 0], [cx + L.trunkHW, 0], [cx + L.trunkHW, L.trunkH], [cx - L.trunkHW, L.trunkH]], flat ? th.shadowSolid : th.trunk);
    if (!flat) fillPoly(g, P, [[cx + L.trunkHW * 0.2, 0], [cx + L.trunkHW, 0], [cx + L.trunkHW, L.trunkH], [cx + L.trunkHW * 0.2, L.trunkH]], th.trunkShade);
    for (const q of L.tiers) {
      fillPoly(g, P, [[cx - q.bw, q.a], [cx + q.bw, q.a], [cx + q.tw, q.b], [cx - q.tw, q.b]], flat ? th.shadowSolid : th.leaf);
      if (!flat) {
        fillPoly(g, P, [[cx, q.a], [cx + q.bw, q.a], [cx + q.tw, q.b], [cx, q.b]], th.leafShade);
        fillPoly(g, P, [[cx - q.bw, q.a], [cx - q.bw * 0.78, q.a], [cx - q.tw * 0.78, q.b], [cx - q.tw, q.b]], th.leafLight);
      }
    }
  }

  function paintOak(g, o, P, th, flat) {
    const L = o.look, cx = L.cx;
    fillPoly(g, P, [[cx - L.trunkHW, 0], [cx + L.trunkHW, 0], [cx + L.trunkHW, L.trunkTop + 4], [cx - L.trunkHW, L.trunkTop + 4]], flat ? th.shadowSolid : th.trunk);
    if (!flat) fillPoly(g, P, [[cx + L.trunkHW * 0.2, 0], [cx + L.trunkHW, 0], [cx + L.trunkHW, L.trunkTop + 4], [cx + L.trunkHW * 0.2, L.trunkTop + 4]], th.trunkShade);
    fillPoly(g, P, L.canopyPts, flat ? th.shadowSolid : th.leaf);
    if (flat) return;
    g.save();
    pathPoly(g, P, L.canopyPts);
    g.clip();
    const s = P(cx + L.rx * 0.55, L.tc - L.ry * 0.35);
    g.fillStyle = th.leafShade;
    g.beginPath(); g.arc(s[0], s[1], L.rx * 0.95, 0, Math.PI * 2); g.fill();
    g.fillStyle = th.leafLight;
    const dots = [[-0.45, 0.42, 0.17], [-0.12, 0.62, 0.12], [-0.55, 0.05, 0.11]];
    for (const d of dots) {
      const c = P(cx + L.rx * d[0], L.tc + L.ry * d[1]);
      g.beginPath(); g.arc(c[0], c[1], L.rx * d[2], 0, Math.PI * 2); g.fill();
    }
    g.restore();
  }

  function paintRock(g, o, P, th, flat) {
    const L = o.look;
    fillPoly(g, P, L.outline, flat ? th.shadowSolid : th.rock);
    if (flat) return;
    g.save();
    pathPoly(g, P, L.outline);
    g.clip();
    fillPoly(g, P, L.dark, th.rockShade);
    g.globalAlpha = 0.55;
    fillPoly(g, P, L.light, th.rockLight);
    g.globalAlpha = 1;
    g.strokeStyle = th.crack;
    g.lineWidth = 2;
    g.lineJoin = 'round';
    for (const line of L.cracks) {
      g.beginPath();
      line.forEach((pt, i) => { const q = P(pt[0], pt[1]); if (i) g.lineTo(q[0], q[1]); else g.moveTo(q[0], q[1]); });
      g.stroke();
    }
    g.restore();
  }
  function paintTower(g, o, P, th, flat) {
    const L = o.look, cx = L.cx;
    fillPoly(g, P, [[cx - L.antennaHW, L.bodyH], [cx + L.antennaHW, L.bodyH], [cx + L.antennaHW * 0.4, L.bodyH + L.antennaH], [cx - L.antennaHW * 0.4, L.bodyH + L.antennaH]], flat ? th.shadowSolid : th.antenna);
    for (const q of L.tiers) {
      fillPoly(g, P, [[cx - q.hw, q.a], [cx + q.hw, q.a], [cx + q.hw, q.b], [cx - q.hw, q.b]], flat ? th.shadowSolid : th.body);
      if (!flat) {
        fillPoly(g, P, [[cx + q.hw * 0.35, q.a], [cx + q.hw, q.a], [cx + q.hw, q.b], [cx + q.hw * 0.35, q.b]], th.bodyShade);
        fillPoly(g, P, [[cx - q.hw, q.a], [cx - q.hw * 0.82, q.a], [cx - q.hw * 0.82, q.b], [cx - q.hw, q.b]], th.bodyLight);
      }
    }
    if (flat) return;
    for (const wnd of L.windows) {
      g.fillStyle = wnd.warm ? th.windowLit : th.windowCool;
      const a = P(wnd.x, wnd.y), b = P(wnd.x + wnd.w, wnd.y + wnd.h);
      g.fillRect(Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]));
    }
    const tip = P(cx, L.bodyH + L.antennaH);
    g.fillStyle = th.antennaLight;
    g.beginPath(); g.arc(tip[0], tip[1], 1.6, 0, Math.PI * 2); g.fill();
  }
  function paintPipe(g, o, P, th, flat) {
    const L = o.look, cx = L.cx;
    fillPoly(g, P, [[cx - L.pipeHW, 0], [cx + L.pipeHW, 0], [cx + L.pipeHW, L.bodyH], [cx - L.pipeHW, L.bodyH]], flat ? th.shadowSolid : th.pipe);
    if (!flat) {
      fillPoly(g, P, [[cx + L.pipeHW * 0.3, 0], [cx + L.pipeHW, 0], [cx + L.pipeHW, L.bodyH], [cx + L.pipeHW * 0.3, L.bodyH]], th.pipeShade);
      fillPoly(g, P, [[cx - L.pipeHW, 0], [cx - L.pipeHW * 0.75, 0], [cx - L.pipeHW * 0.75, L.bodyH], [cx - L.pipeHW, L.bodyH]], th.pipeLight);
    }
    fillPoly(g, P, [[cx - L.pipeHW, L.bodyH], [cx + L.pipeHW, L.bodyH], [cx + L.capHW, L.bodyH + L.capH], [cx - L.capHW, L.bodyH + L.capH]], flat ? th.shadowSolid : th.pipeShade);
    if (flat) return;
    for (const jy of L.joints) {
      const y0 = jy - L.flangeH / 2, y1 = jy + L.flangeH / 2;
      fillPoly(g, P, [[cx - L.flangeHW, y0], [cx + L.flangeHW, y0], [cx + L.flangeHW, y1], [cx - L.flangeHW, y1]], th.flange);
      g.fillStyle = th.rivet;
      for (let k = -2; k <= 2; k++) {
        const rx = cx + k * (L.flangeHW * 0.42);
        if (Math.abs(rx - cx) > L.flangeHW - 1.5) continue;
        const q = P(rx, y0 + L.flangeH * 0.22);
        g.fillRect(q[0] - 1, q[1] - 1, 2, 2);
      }
    }
    if (L.valveAt != null) {
      const r = Math.min(L.pipeHW * 0.82, 5.5);
      const c = P(cx, L.valveAt);
      g.strokeStyle = th.rivet; g.lineWidth = 1.3;
      g.beginPath(); g.arc(c[0], c[1], r, 0, Math.PI * 2); g.stroke();
      for (let a = 0; a < 4; a++) {
        const ang = a * Math.PI / 2 + 0.4;
        g.beginPath(); g.moveTo(c[0], c[1]); g.lineTo(c[0] + Math.cos(ang) * r, c[1] + Math.sin(ang) * r); g.stroke();
      }
    }
    g.fillStyle = th.steam;
    g.globalAlpha = 0.5;
    const tip = P(cx, L.bodyH + L.capH * 0.7);
    g.beginPath(); g.arc(tip[0] - 1.5, tip[1], 2.2, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.arc(tip[0] + 1.5, tip[1] - 1, 1.8, 0, Math.PI * 2); g.fill();
    g.globalAlpha = 1;
  }
  function paintLava(g, o, P, th, flat) {
    const L = o.look;
    if (flat) { for (const sl of L.slabs) fillPoly(g, P, sl.pts, th.shadowSolid); return; }
    const trace = (line) => {
      g.beginPath();
      line.forEach((pt, i) => { const q = P(pt[0], pt[1]); if (i) g.lineTo(q[0], q[1]); else g.moveTo(q[0], q[1]); });
    };
    g.lineJoin = 'round';
    g.lineCap = 'round';
    L.slabs.forEach((sl, k) => {
      const { c, hwB, hwT, a, b } = sl;
      fillPoly(g, P, sl.pts, th.crust);
      g.save();
      pathPoly(g, P, sl.pts);
      g.clip();
      fillPoly(g, P, [[c + hwB * 0.3, a - 4], [c + hwB + 30, a - 4], [c + hwT + 30, b + 4], [c + hwT * 0.3, b + 4]], th.crustShade);
      g.globalAlpha = 0.6;
      fillPoly(g, P, [[c - hwB - 30, a - 4], [c - hwB * 0.7, a - 4], [c - hwT * 0.7, b + 4], [c - hwT - 30, b + 4]], th.crustLight);
      g.globalAlpha = 1;
      for (const line of sl.cracks) {
        trace(line); g.strokeStyle = th.lava; g.lineWidth = 2.6; g.stroke();
        trace(line); g.strokeStyle = th.lavaHot; g.lineWidth = 1; g.stroke();
      }
      if (k === L.slabs.length - 1) {                  // the tip is molten: a hot band along the top edge
        const capH = clamp((b - a) * 0.3, 8, 24), tl = b - sl.dL, tr = b - sl.dR, ex = hwB + 30;
        fillPoly(g, P, [[c - ex, tl + 3], [c + ex, tr + 3], [c + ex, tr - capH], [c - ex, tl - capH]], th.lava);
        fillPoly(g, P, [[c - ex, tl + 3], [c + ex, tr + 3], [c + ex, tr - capH * 0.4], [c - ex, tl - capH * 0.4]], th.lavaHot);
      }
      g.restore();
      // a glowing seam around every block
      pathPoly(g, P, sl.pts);
      g.globalAlpha = 0.3; g.strokeStyle = th.lava; g.lineWidth = 5; g.stroke();
      g.globalAlpha = 1; g.lineWidth = 1.8; g.stroke();
    });
  }
  function paintIce(g, o, P, th, flat) {
    const L = o.look;
    fillPoly(g, P, L.outline, flat ? th.shadowSolid : th.ice);
    if (flat) return;
    g.save();
    pathPoly(g, P, L.outline);
    g.clip();
    fillPoly(g, P, L.dark, th.iceShade);
    g.globalAlpha = 0.9;
    fillPoly(g, P, L.light, th.iceLight);
    g.globalAlpha = 1;
    g.lineJoin = 'round';
    g.lineCap = 'round';
    const trace = (line) => {
      g.beginPath();
      line.forEach((pt, i) => { const q = P(pt[0], pt[1]); if (i) g.lineTo(q[0], q[1]); else g.moveTo(q[0], q[1]); });
    };
    g.strokeStyle = th.iceLight; g.globalAlpha = 0.75; g.lineWidth = 1.5;   // the ridge between the two faces
    trace(L.ridge); g.stroke();
    g.globalAlpha = 0.5; g.lineWidth = 1.2;                                  // growth lines across the left face
    for (const line of L.lines) { trace(line); g.stroke(); }
    g.globalAlpha = 0.95; g.lineWidth = 2;                                   // frost along each step-in
    for (const line of L.frost) { trace(line); g.stroke(); }
    g.globalAlpha = 1;
    g.fillStyle = th.iceLight;                                               // a couple of glints
    for (const s of L.glints) {
      const r = s.r, k = r * 0.28;
      fillPoly(g, P, [[s.u, s.t + r], [s.u + k, s.t + k], [s.u + r, s.t], [s.u + k, s.t - k], [s.u, s.t - r], [s.u - k, s.t - k], [s.u - r, s.t], [s.u - k, s.t + k]], th.iceLight);
    }
    g.restore();
    pathPoly(g, P, L.outline);
    g.strokeStyle = th.iceEdge; g.lineWidth = 2;
    g.stroke();
  }
  function paintCoil(g, o, P, th, flat) {
    const L = o.look, cx = L.cx, w = L.w;
    fillPoly(g, P, L.outline, flat ? th.shadowSolid : th.coilBody);
    if (flat) return;
    const band = (t0, t1, u0, u1, color, alpha) => {
      g.globalAlpha = alpha;
      fillPoly(g, P, [[u0, t0], [u1, t0], [u1, t1], [u0, t1]], color);
      g.globalAlpha = 1;
    };
    const hline = (t, u0, u1) => { const a = P(u0, t), b = P(u1, t); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); };
    const ring = (t, a, b) => { const c = P(cx, t); g.beginPath(); g.ellipse(c[0], c[1], a, b, 0, 0, Math.PI * 2); };
    g.save();
    pathPoly(g, P, L.outline);
    g.clip();
    // base plate, and the flare with its primary winding
    band(-2, L.s0, -5, w + 5, th.coilMetal, 1);
    band(L.pb - 1.5, L.pb + 0.5, -5, w + 5, th.coilLight, 0.35);
    g.strokeStyle = th.copper; g.lineWidth = 1.6; g.beginPath();
    hline(L.pb + L.fl * 0.4, cx - L.hwS * 1.6, cx + L.hwS * 1.6);
    hline(L.pb + L.fl * 0.75, cx - L.hwS * 1.6, cx + L.hwS * 1.6);
    g.stroke();
    // the shaft: a lit side, a shaded side, copper windings, then a touch of roundness over the top
    const y1 = L.torMid;
    band(L.s0, y1, -5, w + 5, th.coilShade, 1);                       // a dark core for the copper to sit on
    band(L.s0, y1, cx - L.hwS * 1.4, cx - L.hwS * 0.3, th.coilLight, 0.28);
    g.strokeStyle = th.copper; g.lineWidth = 2; g.beginPath();
    for (let t = L.s0 + 3; t < L.torBot - 1; t += 4.4) hline(t, cx - L.hwS * 1.4, cx + L.hwS * 1.4);
    g.stroke();
    band(L.s0, y1, cx + L.hwS * 0.2, cx + L.hwS * 1.4, th.deep, 0.42);
    band(L.s0, y1, cx - L.hwS * 1.4, cx - L.hwS * 0.55, '#FFFFFF', 0.2);
    for (const c of L.collars) {
      band(c.t0, c.t1, cx - L.hwS * 1.4, cx + L.hwS * 1.4, th.coilMetal, 1);
      band(c.t1 - 1.4, c.t1, cx - L.hwS * 1.4, cx + L.hwS * 1.4, th.coilLight, 0.5);
    }
    // the ring: chrome, shaded on the right, with a charged rim
    g.fillStyle = th.chrome; ring(L.torMid, L.hwT, L.tt / 2); g.fill();
    g.save(); ring(L.torMid, L.hwT, L.tt / 2); g.clip();
    band(L.torBot - 2, L.torTop + 2, cx + L.hwT * 0.3, w + 5, th.chromeShade, 1);
    g.restore();
    g.strokeStyle = th.arc; g.globalAlpha = 0.85; g.lineWidth = 1.4; ring(L.torMid, L.hwT, L.tt / 2); g.stroke(); g.globalAlpha = 1;
    // the terminal ball
    g.fillStyle = th.chrome; ring(L.ballMid, L.br, L.br); g.fill();
    g.save(); ring(L.ballMid, L.br, L.br); g.clip();
    band(L.ballBot - 2, L.h + 2, cx + L.br * 0.25, cx + L.br + 3, th.chromeShade, 1);
    g.restore();
    const hi = P(cx - L.br * 0.35, L.ballMid + L.br * 0.3);
    g.fillStyle = '#FFFFFF'; g.globalAlpha = 0.9; g.beginPath(); g.arc(hi[0], hi[1], Math.max(1.2, L.br * 0.22), 0, Math.PI * 2); g.fill();
    g.strokeStyle = th.arc; g.globalAlpha = 0.9; g.lineWidth = 1.2; ring(L.ballMid, L.br, L.br); g.stroke(); g.globalAlpha = 1;
    g.restore();
  }
  function paintKelp(g, o, P, th, flat) {
    const L = o.look;
    for (const b of L.blades) {
      const steps = 14;
      const left = [], right = [];
      for (let k = 0; k <= steps; k++) {
        const t = (b.bh * k) / steps;
        const [l, r] = L.bladeAt(b, t);
        left.push([l, t]); right.push([r, t]);
      }
      const poly = left.concat(right.slice().reverse());
      fillPoly(g, P, poly, flat ? th.shadowSolid : th.weed);
      if (flat) continue;
      g.save();
      pathPoly(g, P, poly);
      g.clip();
      // a shaded stripe down the trailing side and a light streak down the leading side, so each blade reads as round
      const shadeSide = [], lightSide = [];
      for (let k = 0; k <= steps; k++) {
        const t = (b.bh * k) / steps;
        const [l, r] = L.bladeAt(b, t);
        const mid = (l + r) / 2;
        shadeSide.push([mid + (r - mid) * 0.35, t]);
        lightSide.push([mid - (mid - l) * 0.35, t]);
      }
      fillPoly(g, P, right.concat(shadeSide.slice().reverse()), th.weedShade);
      g.globalAlpha = 0.85;
      fillPoly(g, P, left.concat(lightSide.slice().reverse()), th.weedLight);
      g.globalAlpha = 1;
      g.restore();
    }
    if (flat) return;
    g.fillStyle = th.stem;
    const bw = clamp(o.w * 0.1, 3, 8);
    fillPoly(g, P, [[L.cx - bw, 0], [L.cx + bw, 0], [L.cx + bw * 0.6, 6], [L.cx - bw * 0.6, 6]], th.stem);
  }

  function paintCoral(g, o, P, th, flat) {
    const L = o.look, pal = th.coralPalette[L.variant % th.coralPalette.length];
    fillPoly(g, P, L.outline, flat ? th.shadowSolid : pal.base);
    if (flat) return;
    g.save();
    pathPoly(g, P, L.outline);
    g.clip();
    fillPoly(g, P, L.dark, pal.shade);
    g.globalAlpha = 0.55;
    fillPoly(g, P, L.light, pal.light);
    g.globalAlpha = 1;
    g.fillStyle = th.polyp;
    for (const q of L.polyps) {
      const c = P(q.u, q.t);
      g.globalAlpha = 0.85;
      g.beginPath(); g.arc(c[0], c[1], q.r, 0, Math.PI * 2); g.fill();
    }
    g.globalAlpha = 1;
    g.restore();
  }

  function paintLighthouse(g, o, P, th, flat) {
    const L = o.look, cx = L.cx;
    // the tapering stone shaft
    fillPoly(g, P, [[cx - L.baseHW, 0], [cx + L.baseHW, 0], [cx + L.shaftTopHW, L.bodyH], [cx - L.shaftTopHW, L.bodyH]], flat ? th.shadowSolid : th.tower);
    if (!flat) {
      fillPoly(g, P, [[cx, 0], [cx + L.baseHW, 0], [cx + L.shaftTopHW, L.bodyH], [cx, L.bodyH]], th.towerShade);
      fillPoly(g, P, [[cx - L.baseHW, 0], [cx - L.baseHW * 0.72, 0], [cx - L.shaftTopHW * 0.72, L.bodyH], [cx - L.shaftTopHW, L.bodyH]], th.towerLight);
      // a dark trim band partway up
      const bw0 = L.shaftHW(L.bandY), bw1 = L.shaftHW(L.bandY + L.bandH);
      fillPoly(g, P, [[cx - bw0, L.bandY], [cx + bw0, L.bandY], [cx + bw1, L.bandY + L.bandH], [cx - bw1, L.bandY + L.bandH]], th.band);
      // a few lit portholes up the shaft
      for (const wnd of L.windows) {
        const c = P(cx + wnd.u, wnd.t);
        g.fillStyle = wnd.warm ? th.glassCore : th.band;
        g.globalAlpha = wnd.warm ? 0.95 : 0.6;
        g.beginPath(); g.arc(c[0], c[1], wnd.r, 0, Math.PI * 2); g.fill();
      }
      g.globalAlpha = 1;
    }
    // the railed gallery walkway, wider than the shaft it sits on
    const gY0 = L.bodyH, gY1 = L.galleryY1;
    fillPoly(g, P, [[cx - L.galleryHW, gY0], [cx + L.galleryHW, gY0], [cx + L.galleryHW, gY1], [cx - L.galleryHW, gY1]], flat ? th.shadowSolid : th.rail);
    if (!flat) {
      g.strokeStyle = th.roofShade;
      g.lineWidth = 1;
      g.globalAlpha = 0.8;
      g.beginPath();
      for (let k = -3; k <= 3; k++) {
        const rx = cx + k * (L.galleryHW * 0.4);
        if (Math.abs(rx - cx) > L.galleryHW - 1) continue;
        const a = P(rx, gY0), b = P(rx, gY1);
        g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]);
      }
      g.stroke();
      g.globalAlpha = 1;
    }
    // the glazed lamp room, with a bright core where the lamp mechanism sits
    const lY0 = gY1, lY1 = L.lampY1;
    fillPoly(g, P, [[cx - L.lampHW, lY0], [cx + L.lampHW, lY0], [cx + L.lampHW, lY1], [cx - L.lampHW, lY1]], flat ? th.shadowSolid : th.rail);
    if (!flat) {
      fillPoly(g, P, [[cx - L.lampHW * 0.82, lY0 + 1.5], [cx + L.lampHW * 0.82, lY0 + 1.5], [cx + L.lampHW * 0.82, lY1 - 1.5], [cx - L.lampHW * 0.82, lY1 - 1.5]], th.glass);
      g.strokeStyle = th.rail;
      g.lineWidth = 1.3;
      g.beginPath();
      for (let k = -1; k <= 1; k++) {
        const rx = cx + k * L.lampHW * 0.55;
        const a = P(rx, lY0), b = P(rx, lY1);
        g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]);
      }
      g.stroke();
      const c = P(cx, (lY0 + lY1) / 2);
      g.fillStyle = th.glassCore;
      g.beginPath(); g.arc(c[0], c[1], Math.max(2, L.lampHW * 0.42), 0, Math.PI * 2); g.fill();
    }
    // the conical roof
    const rY0 = lY1, rY1 = L.capY1;
    fillPoly(g, P, [[cx - L.lampHW, rY0], [cx + L.lampHW, rY0], [cx + L.finialR, rY1], [cx - L.finialR, rY1]], flat ? th.shadowSolid : th.roof);
    if (!flat) fillPoly(g, P, [[cx, rY0], [cx + L.lampHW, rY0], [cx + L.finialR, rY1], [cx, rY1]], th.roofShade);
    // the finial rod and ball
    fillPoly(g, P, [[cx - L.finialR, rY1], [cx + L.finialR, rY1], [cx + L.finialR, o.h], [cx - L.finialR, o.h]], flat ? th.shadowSolid : th.roofShade);
    if (!flat) {
      const tip = P(cx, o.h - L.finialR * 0.4);
      g.fillStyle = th.roofShade;
      g.beginPath(); g.arc(tip[0], tip[1], L.finialR, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.5)';
      g.beginPath(); g.arc(tip[0] - L.finialR * 0.3, tip[1] - L.finialR * 0.3, Math.max(0.6, L.finialR * 0.35), 0, Math.PI * 2); g.fill();
    }
  }

  const PAINT = { pine: paintPine, oak: paintOak, rock: paintRock, tower: paintTower, pipe: paintPipe, lava: paintLava, ice: paintIce, coil: paintCoil, kelp: paintKelp, coral: paintCoral, lighthouse: paintLighthouse };

  // Same hard drop shadow the original blocks have, then the shape itself.
  function paintObstacle(g, o, top, bot, th) {
    const P = o.side === 'floor' ? (u, t) => [o.x + u, bot - t] : (u, t) => [o.x + u, top + t];
    const fn = PAINT[o.look.kind];
    g.save();
    g.translate(7, 7);
    fn(g, o, P, th, true);
    g.restore();
    fn(g, o, P, th, false);
  }

