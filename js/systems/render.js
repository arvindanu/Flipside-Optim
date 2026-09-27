'use strict';

  function drawBackdrop() {
    if (currentMap.style === 'city') {
      drawSkyline();
    } else {
      ctx.fillStyle = T.hill;
      const span = W + 500;
      for (let i = 0; i < 4; i++) {
        const x = ((((i * span) / 4 - world * 0.06) % span) + span) % span - 250;
        const y = TOP + 60 + ((i * 131) % Math.max(40, CORR - 160));
        circle(x, y, 110 + ((i * 47) % 60));
      }
      if (currentMap.style === 'lava') drawVolcanoes();
      else if (currentMap.style === 'ice') drawPeaks();
      else if (currentMap.style === 'coil') drawStorm();
      else if (currentMap.style === 'ocean') drawReef();
      else if (currentMap.style === 'lighthouse') drawIslands();
    }
    if (currentMap.style === 'ice') drawSnow();
    else if (currentMap.style === 'coil') drawSparks();
    else if (currentMap.style === 'ocean') { drawCaustics(); drawOceanBubbles(); }
    else if (currentMap.style === 'lighthouse') { drawStars(); drawMist(); }
    if (lite) return;
    // One dot grid, one path, one fill (same positions as before - each dot gets its own moveTo so the
    // subpaths stay separate circles instead of one wandering line, exactly like the snow does it).
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    const gs = 44, gr = 2.6;
    const off = (world * 0.3) % gs;
    let row = 0;
    ctx.beginPath();
    for (let y = TOP + gs / 2; y < BOT; y += gs, row++) {
      const shift = (row % 2) * gs / 2;
      for (let x = -off - shift; x < W + gs; x += gs) { ctx.moveTo(x + gr, y); ctx.arc(x, y, gr, 0, Math.PI * 2); }
    }
    ctx.fill();
    if (currentMap.style === 'lava') drawEmbers();
  }

  function drawObstacles() {
    for (const o of obstacles) {
      if (o.look) {                                    // trees and rocks: copy the pre-painted sprite
        const cv = spriteFor(o);
        if (o.x > W + 12 || o.x + o.w + 12 < 0) continue;
        const sw = Math.min(cv.width, Math.ceil((o.w + 10) * scx)), sh = Math.min(cv.height, Math.ceil((o.h + 10) * scy));
        const dx = Math.round(o.x * scx) / scx;
        const dy = Math.round((o.side === 'floor' ? BOT - o.h : TOP) * scy) / scy;
        ctx.drawImage(cv, 0, 0, sw, sh, dx, dy, sw / scx, sh / scy);
        continue;
      }
      const y = o.side === 'floor' ? BOT - o.h : TOP;
      ctx.fillStyle = 'rgba(20,26,122,0.55)';
      ctx.fillRect(o.x + 7, y + 7, o.w, o.h);
      ctx.fillStyle = C.pink;
      ctx.fillRect(o.x, y, o.w, o.h);
      ctx.fillStyle = C.blush;
      if (o.side === 'floor') ctx.fillRect(o.x, y, o.w, 10);
      else ctx.fillRect(o.x, y + o.h - 10, o.w, 10);
    }
  }

  function drawOrbs() {
    for (const o of orbs) {
      const ox = coinX(o);
      if (o.boost) {
        ctx.fillStyle = C.sun;
        circle(ox, o.y, 9);
        ctx.fillStyle = C.blush;
        circle(ox, o.y, 4);
      } else if (o.mega) {
        const pulse = 1 + (reduce ? 0 : Math.sin(clock * 7) * 0.1);
        ctx.fillStyle = 'rgba(255,210,63,0.22)';
        circle(ox, o.y, 36 * pulse);
        ctx.strokeStyle = C.blush;
        ctx.lineWidth = 3;
        ctx.setLineDash(DASH_MEGA);
        ctx.lineDashOffset = -(clock * 40) % 18;
        ctx.beginPath(); ctx.arc(ox, o.y, 28 * pulse, 0, Math.PI * 2); ctx.stroke();
        ctx.setLineDash(DASH_NONE);
        ctx.fillStyle = C.sun;
        circle(ox, o.y, 17);
        ctx.fillStyle = C.blush;
        circle(ox, o.y, 8);
      } else {
        const pulse = 1 + (reduce ? 0 : Math.sin(clock * 6 + o.x * 0.02) * 0.12);
        ctx.strokeStyle = 'rgba(255,92,147,0.9)';
        ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.arc(ox, o.y, 18 * pulse, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = C.blush;
        circle(ox, o.y, 11);
      }
    }
  }

  function drawWalls() {
    ctx.fillStyle = C.deep;
    ctx.fillRect(-30, -30, W + 60, TOP + 30);
    ctx.fillRect(-30, BOT, W + 60, H - BOT + 30);
    ctx.strokeStyle = 'rgba(255,227,236,0.35)';
    ctx.lineWidth = 3;
    ctx.setLineDash(DASH_WALL);
    ctx.lineDashOffset = world % 44;
    ctx.beginPath(); ctx.moveTo(0, TOP - 8); ctx.lineTo(W, TOP - 8); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, BOT + 8); ctx.lineTo(W, BOT + 8); ctx.stroke();
    ctx.setLineDash(DASH_NONE);
  }

  const trailColorCache = new Map();
  function trailColor(trail, n, k) {
    const key = trail + '|' + n + '|' + k;
    let s = trailColorCache.get(key);
    if (s === undefined) {
      const a = 0.24 * (1 - k / (n + 1));
      s = 'rgba(' + trail + ',' + a.toFixed(3) + ')';
      trailColorCache.set(key, s);
    }
    return s;
  }
  function drawTrail() {
    if (reduce || lite || state !== 'playing' || boostMode === 'rocket') return;
    const n = p.hist.length;
    for (let k = 1; k < n; k++) {
      const s = S * (1 - k * 0.05);
      ctx.fillStyle = trailColor(SP.trail, n, k);
      ctx.fillRect(PX + (S - s) / 2 - k * run.speed * 0.016, p.hist[k] + (S - s) / 2, s, s);
    }
  }

  // A handful of bubbles streaming off the sprite on the Ocean map: they start right behind it (using the same
  // position history the trail uses) and drift upward as they age, fading out. Purely decorative, drawn behind the
  // sprite, and never touches the hitbox.
  function drawPlayerBubbles() {
    if (currentMap.style !== 'ocean' || lite || state !== 'playing') return;
    const n = 7, cx = PX + S / 2;
    ctx.fillStyle = T.bubble;
    for (let i = 0; i < n; i++) {
      const age = ((reduce ? 0 : clock) * 0.7 + i / n) % 1;          // 0 = just born, 1 = about to be recycled
      const hk = Math.min(p.hist.length - 1, 1 + Math.floor(age * 5));
      const baseY = (p.hist[hk] != null ? p.hist[hk] : p.y) + S / 2;
      const x = cx - S * 0.4 - age * S * 1.1 + (reduce ? 0 : Math.sin(clock * 3.2 + i * 2.1) * 2.5);
      const y = baseY - age * CORR * 0.4;
      const r = 1.2 + (i % 3) * 0.7;
      ctx.globalAlpha = (1 - age) * 0.8;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawSpeedLines() {
    if (speedMul < 1.06 || reduce) return;
    const a = clamp((speedMul - 1) / (BOOST_SPEED - 1), 0, 1) * 0.28;
    ctx.strokeStyle = 'rgba(255,255,255,' + a.toFixed(3) + ')';
    ctx.lineWidth = 2;
    const span = W + 300;
    for (let i = 0; i < 12; i++) {
      const y = TOP + 20 + ((i * 97) % Math.max(60, CORR - 40));
      const len = 70 + ((i * 53) % 110);
      const x = span - ((((world * 1.8 + i * 173) % span) + span) % span) - 150;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + len, y); ctx.stroke();
    }
  }

  function drawRocket() {
    const cx = PX + S / 2, cy = p.y + S / 2;
    const ang = clamp(Math.atan2(p.vy, Math.max(run.speed, 1)), -0.6, 0.6);
    const h = 26;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(ang);
    // flame
    const fl = 14 + (reduce ? 0 : Math.sin(clock * 45) * 5);
    ctx.fillStyle = C.pink;
    ctx.beginPath(); ctx.moveTo(-27, -7); ctx.lineTo(-27 - fl - 6, 0); ctx.lineTo(-27, 7); ctx.closePath(); ctx.fill();
    ctx.fillStyle = C.sun;
    ctx.beginPath(); ctx.moveTo(-27, -4.5); ctx.lineTo(-27 - fl, 0); ctx.lineTo(-27, 4.5); ctx.closePath(); ctx.fill();
    // shadow
    ctx.fillStyle = T.pshadow;
    rr(-29 + 3, -h / 2 + 3, 38, h, 9); ctx.fill();
    // fins
    ctx.fillStyle = C.pink;
    ctx.beginPath(); ctx.moveTo(-23, -h / 2 + 2); ctx.lineTo(-35, -h / 2 - 10); ctx.lineTo(-9, -h / 2 + 2); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-23, h / 2 - 2); ctx.lineTo(-35, h / 2 + 10); ctx.lineTo(-9, h / 2 - 2); ctx.closePath(); ctx.fill();
    // body
    ctx.fillStyle = C.blush;
    rr(-29, -h / 2, 38, h, 9); ctx.fill();
    ctx.fillRect(0, -h / 2, 9, h);
    ctx.fillStyle = C.pink;
    ctx.fillRect(-19, -h / 2, 5, h);
    // nose cone
    ctx.beginPath(); ctx.moveTo(9, -h / 2); ctx.lineTo(35, 0); ctx.lineTo(9, h / 2); ctx.closePath(); ctx.fill();
    // window with the little soul inside
    ctx.fillStyle = C.deep;
    circle(-2, 0, 8.5);
    ctx.fillStyle = SP.body;
    circle(-2, 0, 6.5);
    ctx.fillStyle = C.deep;
    circle(-4.6, -0.4, 1.4);
    circle(0.6, -0.4, 1.4);
    ctx.restore();
  }

  function drawPlayer() {
    if (boostMode === 'rocket') { drawRocket(); return; }
    // blink while landing and for a moment after: blocks can't hurt yet
    if ((boostMode === 'landing' || boostGrace > 0) && !reduce && Math.floor(clock * 14) % 2) ctx.globalAlpha = 0.5;
    let sxq = 1, syq = 1;
    if (p.squash > 0) { syq = 1 - 0.3 * p.squash; sxq = 1 + 0.25 * p.squash; }
    else if (!p.grounded && !reduce) {
      const v = Math.min(1, Math.abs(p.vy) / VMAX);
      syq = 1 + 0.22 * v; sxq = 1 - 0.14 * v;
    }
    const w = S * sxq, h = S * syq;
    const x = PX + (S - w) / 2;
    let y;
    if (p.grounded) y = p.dir === 1 ? p.y + S - h : p.y;
    else y = p.y + (S - h) / 2;
    ctx.fillStyle = T.pshadow;
    rr(x + 4, y + 4, w, h, 8); ctx.fill();
    ctx.fillStyle = SP.body;
    rr(x, y, w, h, 8); ctx.fill();
    paintSpriteFinish(ctx, SP, x, y, w, h);
    ctx.fillStyle = C.deep;
    const ey = y + h / 2 + p.dir * 3;
    circle(x + w * 0.34, ey, 3.6);
    circle(x + w * 0.72, ey, 3.6);
    paintSpriteFace(ctx, SP, x + w / 2, y + h / 2, w, h, p.dir);
    paintSpriteExtras(ctx, SP, x + w / 2, y + h / 2, w, h, spriteHead, reduce ? 0 : clock);
    ctx.globalAlpha = 1;
  }

  function drawParticles() {
    for (const q of parts) {
      ctx.globalAlpha = clamp(q.life / q.max, 0, 1);
      ctx.fillStyle = q.c;
      ctx.fillRect(q.x - q.s / 2, q.y - q.s / 2, q.s, q.s);
    }
    ctx.globalAlpha = 1;
  }

  function drawHUD() {
    if (inMenus()) return;
    const u = 1 / sy;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';

    // Best score stays in the top-left, with the integer directly below "Best".
    ctx.fillStyle = 'rgba(255,227,236,0.72)';
    ctx.font = fontHudLab;
    ctx.fillText('Best', hudL, hudY);

    ctx.fillStyle = C.blush;
    ctx.font = fontHudNum;
    ctx.fillText(String(best), hudL, hudY + 22 * u);
  }

  // Soul meter: top wall, between the score and the pause button.
  function drawSoul() {
    if (inMenus()) return;
    const ux = 1 / sx, uy = 1 / sy;
    const hCss = 14;
    ctx.font = fontSoulLab;
    const label = 'SOUL';
    const labelW = soulLabelW;
    const gap = 10 * ux;
    const left = hudL;
    const right = W - hudR;
    const availCss = (right - left) * sx;
    const labelOn = availCss >= 150;
    const lw = labelOn ? labelW + gap : 0;
    const barCss = clamp(Math.min(availCss - lw * sx, W * sx * 0.42), 50, 300);
    const barW = barCss * ux, hh = hCss * uy;
    const groupW = lw + barW;
    const cx = clamp(W / 2, left + groupW / 2, Math.max(left + groupW / 2, right - groupW / 2));
    const x0 = cx - groupW / 2;
    const cy = hudY;

    if (labelOn) {
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(255,227,236,0.85)';
      ctx.fillText(label, x0, cy);
    }

    const bx = x0 + lw, by = cy - hh / 2;
    rr(bx, by, barW, hh, hh / 2);
    ctx.fillStyle = 'rgba(255,227,236,0.16)';
    ctx.fill();

    const frac = clamp(soul / 100, 0, 1);
    const low = soul < 25;
    ctx.save();
    rr(bx, by, barW, hh, hh / 2);
    ctx.clip();
    if (low && !reduce) {
      const k = 0.5 + 0.5 * Math.sin(clock * (Math.PI * 2 / FUEL_SIREN_STEP));
      ctx.fillStyle = k > 0.5 ? C.pink : C.blush;
    } else {
      ctx.fillStyle = low ? C.pink : C.sun;
    }
    ctx.fillRect(bx, by, barW * frac, hh);
    ctx.restore();

    // tick at 50%: one normal coin refuels this much
    ctx.strokeStyle = 'rgba(20,26,122,0.55)';
    ctx.lineWidth = 2 * uy;
    ctx.beginPath(); ctx.moveTo(bx + barW / 2, by + hh * 0.2); ctx.lineTo(bx + barW / 2, by + hh * 0.8); ctx.stroke();

    rr(bx, by, barW, hh, hh / 2);
    ctx.strokeStyle = soulFlash > 0 ? 'rgba(255,255,255,' + (0.4 + soulFlash).toFixed(2) + ')' : 'rgba(255,227,236,0.5)';
    ctx.lineWidth = (soulFlash > 0 ? 3.5 : 2) * uy;
    ctx.stroke();

    // Current score: centered directly below the Soul/fuel meter.
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = C.blush;
    ctx.font = fontSoulNum;
    const txt = String(state === 'over' ? finalScore : score());
    ctx.fillText(txt, W / 2, cy + 28 * uy);
  }

  function drawFloaters() {
    if (!floaters.length) return;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const f of floaters) {
      ctx.globalAlpha = clamp(f.life / f.max * 1.6, 0, 1);
      ctx.fillStyle = f.big ? C.sun : C.blush;
      ctx.font = f.big ? fontFloatBig : fontFloatSmall;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;
  }

  function drawHint() {
    if (state !== 'playing' || run.t > 5.6) return;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = C.blush;
    ctx.font = fontHint;
    if (run.t < 2.8) {
      ctx.globalAlpha = run.t < 2.2 ? 1 : 1 - (run.t - 2.2) / 0.6;
      ctx.fillText('Tap to flip', W / 2, (TOP + BOT) / 2 - 30);
    }
    if (run.t > 0.8) {
      const a = run.t < 4.9 ? Math.min(1, (run.t - 0.8) / 0.5) : 1 - (run.t - 4.9) / 0.7;
      ctx.globalAlpha = clamp(a, 0, 1);
      ctx.fillText('Grab coins to refuel your soul', W / 2, (TOP + BOT) / 2 + 6);
    }
    ctx.globalAlpha = 1;
  }

  function render() {
    refreshFontCache();
    ctx.setTransform(scx, 0, 0, scy, 0, 0);
    ctx.fillStyle = C.ink;
    ctx.fillRect(0, 0, W, H);
    ctx.save();
    if (shake > 0.1) ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
    drawBackdrop();
    drawSpeedLines();
    drawObstacles();
    if (currentMap.style === 'coil') drawCoilFx();
    drawOrbs();
    drawWalls();
    drawTrail();
    if (state !== 'over') drawPlayer();
    drawParticles();
    drawHUD();
    drawSoul();
    drawFloaters();
    drawHint();
    ctx.restore();
  }

