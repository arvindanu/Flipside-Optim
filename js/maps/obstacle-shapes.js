'use strict';

  // ----- obstacle shapes -----
  // Shapes live in "wall space": u runs along the wall (0..w) and t runs from the wall towards the tip (0..h).
  // Floor obstacles grow up from the floor, ceiling obstacles hang down from the ceiling (gravity flips, so do the trees).
  // Each shape also provides extent(t) = [left, right], the solid part at height t. The drawing and the
  // collision test both come from this same silhouette, so you only ever crash into what you can see.

  function lookPine(w, h, rng) {
    const R = (a, b) => a + rng() * (b - a);
    const cx = w / 2;
    const trunkH = clamp(h * 0.13, 12, 36);
    const trunkHW = clamp(w * 0.085, 4, 9);
    const n = clamp(Math.round(h / R(58, 70)), 2, 9);
    const t0 = trunkH * 0.6;
    const tierH = (h - t0) / (1 + (n - 1) * 0.68);
    const step = tierH * 0.68;
    const tiers = [];
    for (let k = 0; k < n; k++) {
      const f = k / (n - 1);
      const bw = cx * lerp(1.0, 0.6, f) * R(0.94, 1.0);
      const a = t0 + k * step;
      const b = k === n - 1 ? h : a + tierH;
      tiers.push({ a, b, bw, tw: k === n - 1 ? cx * 0.04 : bw * R(0.22, 0.34) });
    }
    const extent = (t) => {
      let hw = t <= trunkH ? trunkHW : 0;
      for (const q of tiers) {
        if (t >= q.a && t <= q.b) hw = Math.max(hw, lerp(q.bw, q.tw, (t - q.a) / (q.b - q.a)));
      }
      return [cx - hw, cx + hw];
    };
    return { kind: 'pine', cx, trunkH, trunkHW, tiers, extent };
  }

  function lookOak(w, h, rng) {
    const R = (a, b) => a + rng() * (b - a);
    const cx = w / 2;
    let canopyH = clamp(Math.max(w * R(1.1, 1.5), h * 0.34), 54, h * 0.66);
    if (h < 96) canopyH = h * 0.74;
    const ry = canopyH / 2, rx = cx, tc = h - ry;
    const trunkTop = h - canopyH * 0.5;
    const trunkHW = clamp(w * 0.1 + h * 0.008, 5, 13);
    const ph = R(0, 6.28), lobe = R(0.05, 0.1);
    const canopyHW = (t) => {
      const d = (t - tc) / ry;
      if (Math.abs(d) >= 1) return 0;
      return rx * Math.sqrt(1 - d * d) * (1 - lobe * (0.5 + 0.5 * Math.sin(d * 9 + ph)));
    };
    const extent = (t) => {
      const hw = Math.max(t <= trunkTop ? trunkHW : 0, canopyHW(t));
      return [cx - hw, cx + hw];
    };
    const pts = [];
    const steps = 22;
    for (let k = 0; k <= steps; k++) { const t = tc - ry + (2 * ry * k) / steps; pts.push([cx - canopyHW(t), t]); }
    for (let k = steps; k >= 0; k--) { const t = tc - ry + (2 * ry * k) / steps; pts.push([cx + canopyHW(t), t]); }
    return { kind: 'oak', cx, trunkTop, trunkHW, tc, ry, rx, canopyPts: pts, extent };
  }

  function lookRock(w, h, rng) {
    const R = (a, b) => a + rng() * (b - a);
    const nV = clamp(Math.round(h / 36) + 4, 6, 15);
    const taper = R(0.26, 0.55), pw = R(1.1, 1.9), lean = R(-0.14, 0.14);
    const bumps = [];
    const nb = rng() < 0.7 ? 3 : 2;
    for (let i = 0; i < nb; i++) bumps.push({ s0: R(0.2, 0.8), sg: R(0.07, 0.14), amp: R(0.16, 0.34) });
    const ss = [0];
    for (let j = 1; j < nV - 1; j++) ss.push(clamp(j / (nV - 1) + R(-0.3, 0.3) / (nV - 1), 0.02, 0.98));
    ss.push(1);
    ss.sort((a, b) => a - b);
    const Lp = [], Rp = [];
    for (let j = 0; j < nV; j++) {
      const s = ss[j];
      let hw = 0.5 * (1 - taper * Math.pow(s, pw));
      for (const b of bumps) hw += b.amp * 0.5 * Math.exp(-Math.pow((s - b.s0) / b.sg, 2));
      const c = 0.5 + lean * s;
      let hl = hw * (1 + (j === 0 ? 0 : R(-0.16, 0.12)));
      let hr = hw * (1 + (j === 0 ? 0 : R(-0.12, 0.16)));
      if (j === nV - 1) { hl = R(0.1, 0.18); hr = R(0.1, 0.18); }
      Lp.push([clamp((c - hl) * w, 0, w), s * h]);
      Rp.push([clamp((c + hr) * w, 0, w), s * h]);
    }
    const at = (P, t) => {
      if (t <= P[0][1]) return P[0][0];
      for (let i = 1; i < P.length; i++) {
        if (t <= P[i][1]) {
          const a = P[i - 1], b = P[i];
          return a[0] + (b[0] - a[0]) * ((t - a[1]) / Math.max(1e-6, b[1] - a[1]));
        }
      }
      return P[P.length - 1][0];
    };
    const extent = (t) => [at(Lp, t), at(Rp, t)];
    // facets and cracks, drawn inside the outline
    const ridge = [0, 0.3, 0.62, 1].map((s) => [clamp((0.5 + lean * s + R(-0.08, 0.08)) * w, 0, w), s * h]);
    const dark = ridge.concat([[w + 30, h], [w + 30, 0]]);
    const light = [[-30, h * 0.3]].concat(ridge.slice(1).map(([u, t]) => [u - w * 0.16, t]), [[-30, h]]);
    const cracks = [];
    for (let i = 0; i < 2; i++) {
      const s = R(0.3, 0.8), fromLeft = rng() < 0.5;
      const e = extent(s * h);
      let u = fromLeft ? e[0] : e[1], t = s * h;
      const line = [[u, t]];
      for (let k = 0; k < 3; k++) { u += (fromLeft ? 1 : -1) * R(4, 12); t -= R(6, 16); line.push([u, t]); }
      cracks.push(line);
    }
    return { kind: 'rock', outline: Lp.concat(Rp.slice().reverse()), dark, light, cracks, extent };
  }

  function lookTower(w, h, rng) {
    const R = (a, b) => a + rng() * (b - a);
    const cx = w / 2;
    const antennaH = clamp(h * R(0.05, 0.11), 5, 26);
    const bodyH = h - antennaH;
    const nSteps = rng() < 0.5 ? 1 : (rng() < 0.7 ? 0 : 2);   // most towers step in once near the top; some are a flat slab; a few step twice
    const tiers = [];
    let hw = cx * R(0.86, 1.0), a = 0;
    for (let k = 0; k <= nSteps; k++) {
      const isLast = k === nSteps;
      const b = isLast ? bodyH : Math.min(bodyH, a + bodyH * R(0.3, 0.46));
      tiers.push({ a, b, hw });
      hw *= R(0.62, 0.8);
      a = b;
      if (a >= bodyH) break;
    }
    const antennaHW = clamp(w * 0.018, 1, 2.2);
    const extent = (t) => {
      if (t > bodyH) return [cx - antennaHW, cx + antennaHW];
      for (const q of tiers) if (t >= q.a && t <= q.b) return [cx - q.hw, cx + q.hw];
      const last = tiers[tiers.length - 1];
      return [cx - last.hw, cx + last.hw];
    };
    // Lit windows: a small grid per tier, decided once here (like the rock's cracks) so painting is just fillRects.
    const windows = [];
    for (const q of tiers) {
      const segH = q.b - q.a;
      if (segH < 14 || q.hw < 8) continue;
      const cols = clamp(Math.floor((q.hw * 2 - 6) / 10), 1, 6);
      const rows = clamp(Math.floor((segH - 6) / 12), 1, 12);
      const cw = (q.hw * 2 - 6) / cols, rh = (segH - 6) / rows;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (rng() < 0.24) continue;                 // some windows are dark
          windows.push({
            x: cx - q.hw + 3 + c * cw + cw * 0.18, y: q.a + 3 + r * rh + rh * 0.18,
            w: cw * 0.64, h: rh * 0.64, warm: rng() < 0.78
          });
        }
      }
    }
    return { kind: 'tower', cx, bodyH, tiers, antennaH, antennaHW, windows, extent };
  }

  function lookPipe(w, h, rng) {
    const R = (a, b) => a + rng() * (b - a);
    const cx = w / 2;
    const pipeHW = clamp(w * R(0.26, 0.36), 7, cx * 0.92);      // the pipe itself stays a near-uniform width (unlike a tapering tree)
    const flangeHW = clamp(pipeHW * R(1.3, 1.55), pipeHW + 2, cx * 0.94);
    const flangeH = clamp(h * 0.032, 4, 9);
    const capH = clamp(h * R(0.06, 0.1), 6, 20);                // a short nozzle cap narrows the very tip, so it can still be skimmed closely
    const capHW = pipeHW * R(0.5, 0.68);
    const bodyH = h - capH;
    const nJoints = clamp(Math.round(bodyH / R(65, 90)), 1, 5);
    const joints = [];
    for (let k = 1; k <= nJoints; k++) joints.push(clamp((k / (nJoints + 1)) * bodyH + R(-8, 8), flangeH, bodyH - flangeH));
    const extent = (t) => {
      if (t > bodyH) {
        const f = clamp((t - bodyH) / capH, 0, 1);
        const hw = lerp(pipeHW, capHW, f);
        return [cx - hw, cx + hw];
      }
      for (const jy of joints) if (t >= jy - flangeH / 2 && t <= jy + flangeH / 2) return [cx - flangeHW, cx + flangeHW];
      return [cx - pipeHW, cx + pipeHW];
    };
    const valveAt = joints.length && rng() < 0.55 ? joints[Math.floor(rng() * joints.length)] : null;
    return { kind: 'pipe', cx, pipeHW, flangeHW, flangeH, joints, bodyH, capH, capHW, valveAt, extent };
  }

  // Magma: a stack of chunky lava blocks, each one skewed a little and nudged sideways, so no two obstacles match.
  // Every block is a convex quad and the silhouette is their union, so the painting and the collision test agree.
  function polyExtent(pts, t) {
    let lo = Infinity, hi = -Infinity;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      if ((a[1] <= t && t <= b[1]) || (b[1] <= t && t <= a[1])) {
        const dt = b[1] - a[1];
        if (dt === 0) { lo = Math.min(lo, a[0], b[0]); hi = Math.max(hi, a[0], b[0]); continue; }
        const u = a[0] + (b[0] - a[0]) * ((t - a[1]) / dt);
        if (u < lo) lo = u;
        if (u > hi) hi = u;
      }
    }
    return lo <= hi ? [lo, hi] : null;
  }

  function lookLava(w, h, rng) {
    const R = (a, b) => a + rng() * (b - a);
    const cx = w / 2;
    const n = clamp(Math.round(h / 72), 2, 6);
    const cuts = [0];
    for (let k = 1; k < n; k++) cuts.push(((k + R(-0.3, 0.3)) / n) * h);
    cuts.push(h);
    const slabs = [];
    for (let k = 0; k < n; k++) {
      const last = k === n - 1;
      const a = cuts[k];
      const b = last ? h : cuts[k + 1] + R(8, 16);               // reaches a little into the next block, so the stack has no gaps
      const f = n > 1 ? k / (n - 1) : 0;
      const hwB = Math.max(6, cx * R(0.78, 1.0) * (1 - 0.3 * f));  // blocks get a bit narrower towards the tip
      const hwT = hwB * R(0.8, 1.0);
      const c = clamp(cx + R(-0.16, 0.16) * w, hwB, w - hwB);
      const drop = last ? R(6, Math.min(30, (b - a) * 0.35)) : R(0, 9);   // one top corner sits lower, so the top is slanted
      const lean = rng() < 0.5;
      const dL = lean ? drop : 0, dR = lean ? 0 : drop;
      const pts = [[c - hwB, a], [c + hwB, a], [c + hwT, b - dR], [c - hwT, b - dL]];
      // glowing cracks, decided once here so painting is only lines
      const cracks = [];
      if (b - a >= 30) {
        const nc = rng() < 0.5 ? 1 : 2;
        for (let i = 0; i < nc; i++) {
          let u = c + R(-0.5, 0.5) * hwT, t = b - drop - R(3, Math.min(16, (b - a) * 0.3));
          const line = [[u, t]];
          for (let q = 0; q < 3; q++) { u += R(-6, 6); t -= R(6, 14); line.push([u, Math.max(a + 2, t)]); }
          cracks.push(line);
        }
      }
      slabs.push({ pts, c, hwB, hwT, a, b, dL, dR, cracks });
    }
    const extent = (t) => {
      let lo = Infinity, hi = -Infinity;
      for (const sl of slabs) {
        const e = polyExtent(sl.pts, t);
        if (e) { if (e[0] < lo) lo = e[0]; if (e[1] > hi) hi = e[1]; }
      }
      return lo <= hi ? [lo, hi] : [cx, cx];
    };
    return { kind: 'lava', slabs, extent };
  }

  // Glaciers: long ice spires, in two families like the forest's pines and oaks. A "crystal" has a straight-sided
  // shaft that ends in a sharp pyramid; a "cone" tapers all the way up. Each side is a broken line with a few kinks
  // and small step-ins, so no two spires match. As with the rocks, the silhouette is one solid stretch per row, and
  // the painting and the collision test both come from it.
  function lookIce(w, h, rng) {
    const R = (a, b) => a + rng() * (b - a);
    const cx = w / 2;
    const crystal = rng() < 0.5;
    const lean = R(-0.16, 0.16) * w;                       // how far the tip sits off-centre
    const shoulder = crystal ? R(0.42, 0.72) : 0;          // where a crystal's straight shaft turns into its tip
    const q = R(0.95, 1.2);                                // a little over 1 makes the tip needle-sharp
    const base = cx * R(0.9, 1.0);
    const ledges = [];
    const nl = rng() < 0.7 ? (h > 200 ? 2 : 1) : 0;       // the shaft steps in a little at one or two heights
    for (let i = 0; i < nl; i++) ledges.push({ s: R(0.16, 0.6), f: R(0.8, 0.92) });
    ledges.sort((a, b) => a.s - b.s);
    const eps = 1.5 / h;
    const halfW = (s) => {
      let hw;
      if (s <= shoulder) hw = lerp(base, base * 0.88, shoulder ? s / shoulder : 0);
      else hw = base * (shoulder ? 0.88 : 1) * Math.pow(Math.max(0, 1 - (s - shoulder) / (1 - shoulder)), q);
      for (const l of ledges) if (s > l.s) hw *= l.f;
      return hw;
    };
    const centre = (s) => cx + lean * Math.pow(s, 1.6);
    // heights where the outline bends: the base, each step-in (twice, for the little ledge), the shoulder, a few kinks, the tip
    let stops = [0, 1];
    for (const l of ledges) stops.push(l.s, l.s + eps);
    if (crystal) stops.push(shoulder);
    const nk = clamp(Math.round(h / 110), 1, 4);
    for (let i = 0; i < nk; i++) stops.push(R(shoulder || 0.1, 0.92));
    stops.sort((a, b) => a - b);
    stops = stops.filter((v, i) => i === 0 || v - stops[i - 1] > 0.0005);   // drop bends that land on top of each other
    const off = R(-0.25, 0.25);                            // the ridge line runs a little off-centre
    const Lp = [], Rp = [], ridge = [];
    stops.forEach((sv, j) => {
      const tip = j === stops.length - 1, first = j === 0;
      const hl = tip ? 1.2 : halfW(sv) * (first ? R(0.97, 1.0) : R(0.94, 1.05));
      const hr = tip ? 1.2 : halfW(sv) * (first ? R(0.97, 1.0) : R(0.94, 1.05));
      const c = centre(sv), t = sv * h;
      Lp.push([clamp(c - hl, 0, w), t]);
      Rp.push([clamp(c + hr, 0, w), t]);
      ridge.push([clamp(c + off * halfW(sv), 0, w), t]);
    });
    const at = (P, t) => {
      if (t <= P[0][1]) return P[0][0];
      for (let i = 1; i < P.length; i++) {
        if (t <= P[i][1]) {
          const a = P[i - 1], b = P[i];
          return a[0] + (b[0] - a[0]) * ((t - a[1]) / Math.max(1e-6, b[1] - a[1]));
        }
      }
      return P[P.length - 1][0];
    };
    const extent = (t) => [at(Lp, t), at(Rp, t)];
    // facets: a bright strip down the left, a cooler face right of the ridge; plus growth lines, ledge frost and glints
    const revMap = (A, fn) => A.slice().reverse().map(fn);
    const light = Lp.concat(revMap(Lp, (pt) => { const j = Lp.indexOf(pt); return [pt[0] + 0.3 * (ridge[j][0] - pt[0]), pt[1]]; }));
    const dark = ridge.concat(revMap(Rp, (pt) => [pt[0] + 30, pt[1]]));
    const lines = [];
    const nlines = h > 90 ? (rng() < 0.5 ? 2 : 3) : 1;
    for (let i = 0; i < nlines; i++) {
      const t = R(0.12, 0.7) * h, e = extent(t), rr0 = at(ridge, t);
      lines.push([[e[0] + 2, t], [rr0 - 2, t + R(4, 10)]]);
    }
    const frost = ledges.map((l) => { const t = (l.s + eps) * h, e = extent(t); return [[e[0] + 1, t], [e[1] - 1, t]]; });
    const glints = [];
    if (h >= 90) {
      const ng = rng() < 0.55 ? 1 : 2;
      for (let i = 0; i < ng; i++) {
        const t = R(0.2, 0.72) * h, e = extent(t), r = R(3, 5);
        glints.push({ u: (e[0] + e[1]) / 2 + R(-0.25, 0.25) * (e[1] - e[0]) * 0.5, t, r });
      }
    }
    return { kind: 'ice', outline: Lp.concat(Rp.slice().reverse()), ridge, light, dark, lines, frost, glints, extent };
  }

  // Tesla: a tall coil, built bottom-up from the wall: a base plate, a flare into the winding, a long shaft wound with
  // copper (with a few collars along it), a wide toroid ring, a short neck and a round terminal ball on the tip. Every
  // width is a function of height, so the silhouette is one solid stretch per row and the painting and the collision
  // test both come from it. The lightning is drawn live over the top (see drawCoilFx) and never changes the hitbox.
  function lookCoil(w, h, rng) {
    const R = (a, b) => a + rng() * (b - a);
    const cx = w / 2;
    const br = clamp(Math.min(w * 0.12, h * 0.15), 5, 14);        // terminal ball radius
    const nk = clamp(br * 0.45, 2, 5);                             // neck between ring and ball
    const tt = clamp(Math.min(w * 0.17, h * 0.2), 8, 24);         // ring thickness
    const pb = clamp(h * 0.08, 6, 16);                             // base plate
    const fl = clamp(h * 0.07, 6, 18);                             // flare from the plate into the shaft
    const ballBot = h - 2 * br, torTop = ballBot - nk, torBot = torTop - tt, torMid = (torBot + torTop) / 2;
    const hwP = cx * R(0.9, 1.0), hwS = cx * R(0.27, 0.37), hwT = cx * R(0.74, 0.93);
    const hwN = clamp(br * 0.35, 1.6, 4);
    const taper = R(0.86, 1.0);                                    // the shaft may narrow a little towards the ring
    const s0 = pb + fl, shaftLen = torBot - s0;
    const collars = [];
    const nc = clamp(Math.round(shaftLen / 90), 0, 4);
    for (let k = 0; k < nc; k++) {
      const slot = shaftLen / (nc + 1), t0 = s0 + slot * (k + 1) + R(-0.12, 0.12) * slot;
      collars.push({ t0, t1: t0 + R(4, 6.5) });
    }
    const ellipse = (t, c, a, b) => { const d = (t - c) / b; return d * d >= 1 ? 0 : a * Math.sqrt(1 - d * d); };
    const shaftHW = (t) => hwS * lerp(1, taper, clamp((t - s0) / Math.max(1, shaftLen), 0, 1));
    const hwAt = (t) => {
      let hw;
      if (t < pb) hw = hwP;
      else if (t < s0) hw = lerp(hwP * 0.6, hwS, Math.pow((t - pb) / fl, 0.7));
      else hw = shaftHW(t);
      for (const c of collars) if (t >= c.t0 && t <= c.t1) hw = Math.max(hw, hwS * 1.28);
      if (t >= torBot && t <= torTop) hw = Math.max(t <= torMid ? shaftHW(t) : 0, ellipse(t, torMid, hwT, tt / 2), hwN);
      else if (t > torTop && t < ballBot) hw = hwN;
      else if (t >= ballBot) hw = Math.max(ellipse(t, ballBot + br, br, br), t < ballBot + br ? hwN : 0);
      return hw;
    };
    // outline: sample the width at every bend, and around the ring and the ball by angle so the curves stay smooth
    let ts = [0, pb - 0.01, pb];
    for (let k = 1; k <= 16; k++) ts.push(pb + fl * k / 16);
    for (const c of collars) ts.push(c.t0 - 0.01, c.t0, c.t1, c.t1 + 0.01);
    for (let k = 0; k <= 14; k++) ts.push(torMid + (tt / 2) * Math.sin(-Math.PI / 2 + Math.PI * k / 14));
    ts.push(torTop + 0.01, ballBot);
    for (let k = 0; k <= 14; k++) ts.push(ballBot + br + br * Math.sin(-Math.PI / 2 + Math.PI * k / 14));
    ts.push(h);
    ts = ts.filter((t) => t >= 0 && t <= h).sort((a, b) => a - b).filter((t, i, A) => i === 0 || t - A[i - 1] > 0.004);
    const Lp = [], Rp = [];
    ts.forEach((t, i) => {
      const hw = Math.min(cx, Math.max(hwAt(t), i === ts.length - 1 ? 0.6 : 0));
      Lp.push([cx - hw, t]);
      Rp.push([cx + hw, t]);
    });
    const extent = (t) => { const hw = hwAt(t); return [cx - hw, cx + hw]; };
    return {
      kind: 'coil', cx, w, h, br, tt, pb, fl, s0, torBot, torTop, torMid, ballBot, ballMid: ballBot + br,
      hwP, hwS, hwT, hwN, collars, outline: Lp.concat(Rp.slice().reverse()), extent, seed: Math.floor(rng() * 1e6)
    };
  }

  // Ocean: a swaying kelp/seaweed cluster, built from a few tapering blades that each wander side to side as they
  // rise (a fixed S-curve, not animated, so the silhouette never disagrees with the hitbox). Every blade shares the
  // same base and the extent at a height is just the widest/narrowest edge across whichever blades reach that high.
  function lookKelp(w, h, rng) {
    const R = (a, b) => a + rng() * (b - a);
    const cx = w / 2;
    const nB = clamp(Math.round(w / 15) + 1, 2, 4);
    const blades = [];
    for (let i = 0; i < nB; i++) {
      const spread = nB > 1 ? (i / (nB - 1) - 0.5) * w * R(0.5, 0.8) : 0;
      blades.push({
        bx: cx + spread,
        bh: h * R(0.68, 1.0),
        baseW: clamp(w * R(0.1, 0.16), 3, 9),
        amp: R(5, 12) * clamp(w / 34, 0.5, 1.7),
        freq: R(1.3, 2.1),
        phase: R(0, 6.28)
      });
    }
    blades.sort((a, b) => b.bh - a.bh);
    const bladeAt = (b, t) => {
      const f = clamp(t / b.bh, 0, 1);
      const lean = b.amp * Math.sin(f * Math.PI * b.freq + b.phase) * f;
      const hw = Math.max(0.8, b.baseW * (1 - f * 0.92));
      const c = b.bx + lean;
      return [c - hw, c + hw];
    };
    const extent = (t) => {
      let lo = Infinity, hi = -Infinity;
      for (const b of blades) {
        if (t > b.bh) continue;
        const [l, r] = bladeAt(b, t);
        if (l < lo) lo = l;
        if (r > hi) hi = r;
      }
      if (lo === Infinity) return [cx, cx];
      return [clamp(lo, 0, w), clamp(hi, 0, w)];
    };
    return { kind: 'kelp', cx, blades, bladeAt, extent };
  }

  // Ocean: a chunky reef mound built the same way as a rock (a broken outline sampled top to bottom), but rounder
  // and bumpier, in one of a handful of bright coral colours, with a scatter of small polyp dots for texture.
  function lookCoral(w, h, rng) {
    const R = (a, b) => a + rng() * (b - a);
    const nV = clamp(Math.round(h / 28) + 4, 6, 14);
    const taper = R(0.3, 0.58), pw = R(0.9, 1.5), lean = R(-0.1, 0.1);
    const bumps = [];
    const nb = 2 + Math.floor(rng() * 3);
    for (let i = 0; i < nb; i++) bumps.push({ s0: R(0.15, 0.85), sg: R(0.09, 0.18), amp: R(0.24, 0.46) });
    const ss = [0];
    for (let j = 1; j < nV - 1; j++) ss.push(clamp(j / (nV - 1) + R(-0.3, 0.3) / (nV - 1), 0.02, 0.98));
    ss.push(1);
    ss.sort((a, b) => a - b);
    const Lp = [], Rp = [];
    for (let j = 0; j < nV; j++) {
      const s = ss[j];
      let hw = 0.5 * (1 - taper * Math.pow(s, pw));
      for (const b of bumps) hw += b.amp * 0.5 * Math.exp(-Math.pow((s - b.s0) / b.sg, 2));
      const c = 0.5 + lean * s;
      let hl = hw * (1 + (j === 0 ? 0 : R(-0.14, 0.14)));
      let hr = hw * (1 + (j === 0 ? 0 : R(-0.14, 0.14)));
      if (j === nV - 1) { hl = R(0.08, 0.16); hr = R(0.08, 0.16); }
      Lp.push([clamp((c - hl) * w, 0, w), s * h]);
      Rp.push([clamp((c + hr) * w, 0, w), s * h]);
    }
    const at = (P, t) => {
      if (t <= P[0][1]) return P[0][0];
      for (let i = 1; i < P.length; i++) {
        if (t <= P[i][1]) {
          const a = P[i - 1], b = P[i];
          return a[0] + (b[0] - a[0]) * ((t - a[1]) / Math.max(1e-6, b[1] - a[1]));
        }
      }
      return P[P.length - 1][0];
    };
    const extent = (t) => [at(Lp, t), at(Rp, t)];
    const ridge = [0, 0.32, 0.64, 1].map((s) => [clamp((0.5 + lean * s + R(-0.08, 0.08)) * w, 0, w), s * h]);
    const dark = ridge.concat([[w + 30, h], [w + 30, 0]]);
    const light = [[-30, h * 0.3]].concat(ridge.slice(1).map(([u, t]) => [u - w * 0.16, t]), [[-30, h]]);
    const variant = Math.floor(rng() * 4);
    const polyps = [];
    const np = clamp(Math.round(h / 26), 3, 9);
    for (let i = 0; i < np; i++) {
      const t = R(h * 0.08, h * 0.94), e = extent(t), sp = e[1] - e[0];
      if (sp < 4) continue;
      polyps.push({ u: e[0] + R(0.2, 0.8) * sp, t, r: R(1.1, 2.4) });
    }
    return { kind: 'coral', outline: Lp.concat(Rp.slice().reverse()), dark, light, variant, polyps, extent };
  }

  // Lighthouse: a tapering stone shaft, a railed gallery walkway, a glazed lamp room with a bright lit core, then a
  // conical roof and a small finial ball on top. Every width is a function of height (like the tower and pipe), so
  // the silhouette is one solid stretch per row and the painting and the collision test both come from it. The
  // sweeping beam is drawn live over the top (see drawLighthouseBeam) and never changes the hitbox.
  function lookLighthouse(w, h, rng) {
    const R = (a, b) => a + rng() * (b - a);
    const cx = w / 2;
    const galleryH = clamp(h * 0.022, 2, 6);
    const lampH = clamp(h * R(0.12, 0.16), 14, 42);
    const capH = clamp(h * R(0.09, 0.12), 9, 24);
    const finialH = clamp(capH * 0.3, 3, 8);
    const bodyH = Math.max(20, h - galleryH - lampH - capH - finialH);
    const baseHW = clamp(cx * R(0.62, 0.78), 7, cx);
    const shaftTopHW = baseHW * R(0.58, 0.74);
    const galleryHW = clamp(shaftTopHW * R(1.3, 1.5), shaftTopHW + 2, cx);
    const lampHW = clamp(galleryHW * R(0.74, 0.86), Math.min(shaftTopHW * 0.94, galleryHW - 1), galleryHW - 1);
    const finialR = clamp(Math.min(w, h) * 0.024, 1.2, 3.4);
    const shaftHW = (t) => lerp(baseHW, shaftTopHW, clamp(t / bodyH, 0, 1));
    const bandY = R(0.32, 0.56) * bodyH, bandH = clamp(h * 0.026, 3, 9);
    // a few lit portholes up the shaft, decided once here so painting is just circles
    const nw = clamp(Math.round(bodyH / 78), 1, 4);
    const windows = [];
    for (let i = 0; i < nw; i++) {
      const t = (i + 0.65) * (bodyH / (nw + 0.3));
      const hwt = shaftHW(t);
      windows.push({ u: R(-0.32, 0.32) * hwt, t, r: clamp(hwt * 0.22, 1.6, 4), warm: rng() < 0.76 });
    }
    const galleryY1 = bodyH + galleryH, lampY1 = galleryY1 + lampH, capY1 = lampY1 + capH;
    const extent = (t) => {
      if (t <= bodyH) { const hw = shaftHW(t); return [cx - hw, cx + hw]; }
      if (t <= galleryY1) return [cx - galleryHW, cx + galleryHW];
      if (t <= lampY1) return [cx - lampHW, cx + lampHW];
      if (t <= capY1) { const f = (t - lampY1) / capH; const hw = lerp(lampHW, finialR, f); return [cx - hw, cx + hw]; }
      return [cx - finialR, cx + finialR];
    };
    return {
      kind: 'lighthouse', cx, bodyH, galleryH, lampH, capH, finialH, baseHW, shaftTopHW, galleryHW, lampHW, finialR,
      bandY, bandH, windows, shaftHW, galleryY1, lampY1, capY1, lampMid: (galleryY1 + lampY1) / 2,
      extent, seed: Math.floor(rng() * 1e6)
    };
  }

  const LOOKS = {
    forest: (w, h, rng, kind) => ((kind || (rng() < 0.62 ? 'pine' : 'oak')) === 'pine' ? lookPine(w, h, rng) : lookOak(w, h, rng)),
    rocky: (w, h, rng) => lookRock(w, h, rng),
    city: (w, h, rng) => lookTower(w, h, rng),
    dawn: (w, h, rng) => lookPipe(w, h, rng),
    lava: (w, h, rng) => lookLava(w, h, rng),
    ice: (w, h, rng) => lookIce(w, h, rng),
    coil: (w, h, rng) => lookCoil(w, h, rng),
    ocean: (w, h, rng, kind) => {
      const pick = kind === 'pine' ? 'kelp' : kind === 'oak' ? 'coral' : (rng() < 0.5 ? 'kelp' : 'coral');
      return pick === 'kelp' ? lookKelp(w, h, rng) : lookCoral(w, h, rng);
    },
    lighthouse: (w, h, rng) => lookLighthouse(w, h, rng)
  };

  // Turn a silhouette into thin slices the collision test can walk through quickly.
  function buildProf(h, extent) {
    const n = clamp(Math.round(h / 4), 16, 200);         // thin slices (about 4px) so slanted edges stay accurate
    const x0 = new Array(n), x1 = new Array(n);
    for (let i = 0; i < n; i++) {
      const e = extent(((i + 0.5) * h) / n);
      x0[i] = e[0]; x1[i] = e[1];
    }
    return { n, x0, x1 };
  }

  function decorateObstacle(o) {
    const st = currentMap.style;
    if (!st) return;                                   // Classic keeps its plain solid blocks
    o.look = LOOKS[st](o.w, o.h, Math.random);
    o.prof = buildProf(o.h, o.look.extent);
  }

  // Does the player's box touch this obstacle? Classic blocks are solid boxes; trees and rocks use their silhouette.
  function hitsObstacle(o, px0, px1, py0, py1) {
    if (!(px1 > o.x && px0 < o.x + o.w)) return false;
    const oy0 = o.side === 'floor' ? BOT - o.h : TOP;
    const oy1 = o.side === 'floor' ? BOT : TOP + o.h;
    if (!(py1 > oy0 && py0 < oy1)) return false;
    const pr = o.prof;
    if (!pr) return true;
    let ta, tb;
    if (o.side === 'floor') { ta = BOT - py1; tb = BOT - py0; } else { ta = py0 - TOP; tb = py1 - TOP; }
    ta = Math.max(0, ta); tb = Math.min(o.h, tb);
    const sh = o.h / pr.n;
    const i0 = Math.min(pr.n - 1, Math.floor(ta / sh));
    const i1 = Math.min(pr.n - 1, Math.floor(tb / sh));
    for (let i = i0; i <= i1; i++) {
      if (px1 > o.x + pr.x0[i] && px0 < o.x + pr.x1[i]) return true;
    }
    return false;
  }

