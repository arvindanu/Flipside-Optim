'use strict';

  // ---------- gameplay ----------
  function flip() {
    if (state !== 'playing' || boostMode !== 'off') return;
    if (p.grounded) doFlip(); else p.buffer = 0.14;
  }
  function doFlip() {
    p.dir *= -1;
    p.grounded = false;
    p.vy = p.dir * KICK;
    p.buffer = 0;
    const wallY = p.dir === 1 ? TOP : BOT;
    burst(PX + S / 2, wallY, 5, [C.blush], 120, 0.35, -run.speed * 0.3);
    sfxFlip();
  }
  function onLand() {
    p.squash = reduce ? 0 : 1;
    const wallY = p.dir === 1 ? BOT : TOP;
    burst(PX + S / 2, wallY, 6, [C.blush, SP.body], 110, 0.4, -run.speed * 0.5);
    sfxLand();
    if (boostMode === 'landing') { boostMode = 'off'; boostGrace = 0.2; }
    if (p.buffer > 0) { p.buffer = 0; doFlip(); }
  }
  function stepPlayer(h) {
    p.vy = clamp(p.vy + G * p.dir * h, -VMAX, VMAX);
    p.y += p.vy * h;
    let landed = false;
    if (p.y >= BOT - S) {
      p.y = BOT - S;
      if (p.vy > 0) { if (p.dir === 1 && !p.grounded) landed = true; p.vy = 0; }
    }
    if (p.y <= TOP) {
      p.y = TOP;
      if (p.vy < 0) { if (p.dir === -1 && !p.grounded) landed = true; p.vy = 0; }
    }
    p.grounded = (p.dir === 1 && p.y >= BOT - S - 0.01) || (p.dir === -1 && p.y <= TOP + 0.01);
    if (landed) onLand();
  }

  function spawnObstacles() {
    const diff = Math.min(1, run.t / 60);
    const wK = Math.max(0.8, K);
    while (cursor < W + 60) {
      const side = nextSide;
      const w = rand(46, 98) * wK;
      const h = rand(70, CORR * lerp(0.5, 0.68, diff));
      const x = cursor;
      const ob = { x, w, h, side };
      decorateObstacle(ob);
      obstacles.push(ob);
      const change = sameRun >= 2 || Math.random() < 0.72;
      let gap;
      if (change) {
        nextSide = side === 'floor' ? 'ceil' : 'floor';
        sameRun = 0;
        const margin = lerp(0.5, 0.25, diff);
        gap = S + baseSpeed() * (FLIGHT + margin) + rand(0, 50) * K;
        if (Math.random() < 0.6) spawnCoin(x + w + gap / 2);
      } else {
        nextSide = side;
        sameRun++;
        gap = rand(60, 170) * K;
      }
      cursor = x + w + gap;
    }
  }

  function crash(reason) {
    state = 'over';
    deathReason = reason || 'block';
    const s = score();
    finalScore = s;
    bankRun();
    isNewBest = best > 0 && s > best;
    if (s > best) { best = s; store.set('flipside-best', best); }
    stopFuelSiren();
    if (deathReason === 'soul') {
      // the soul fades out instead of shattering
      burst(PX + S / 2, p.y + S / 2, 26, [SP.body, C.blush], 200, 1.3, 0);
      shake = 0;
      sfxSoulOut();
    } else {
      burst(PX + S / 2, p.y + S / 2, 34, [SP.body, C.pink, C.blush], 460, 0.95, 0);
      shake = reduce ? 0 : 16;
      sfxCrash();
    }
    crashClock = clock;
    overlayReady = false;
    setUi();
  }

  function update(dt) {
    clock += dt;
    if (state === 'paused') return;
    updateParticles(dt);
    updateFloaters(dt);
    soulFlash = Math.max(0, soulFlash - dt);
    shake = Math.max(0, shake - dt * 40);
    p.squash = Math.max(0, p.squash - dt * 7);

    if (inMenus()) { world += 120 * K * dt; return; }
    if (state === 'over') {
      if (!overlayReady && clock - crashClock > 0.6) { overlayReady = true; showOverlay('over'); }
      return;
    }

    // playing
    run.t += dt;
    spriteHead += ((p.dir === 1 ? 1 : -1) - spriteHead) * Math.min(1, 16 * dt);
    const diff = Math.min(1, run.t / 70);
    const wantMul = boostMode === 'rocket' ? BOOST_SPEED : 1;
    speedMul += (wantMul - speedMul) * (1 - Math.exp(-dt * 4));
    run.speed = baseSpeed() * speedMul;
    updateBoostTimer(dt);
    p.buffer = Math.max(0, p.buffer - dt);
    const late = clamp((run.t - 70) / 100, 0, 1);
    if (boostMode !== 'rocket') soul -= (lerp(SOUL_DRAIN_START, SOUL_DRAIN_END, diff) + SOUL_DRAIN_LATE * late) * dt;   // the soul burns like fuel (the rocket flies on its own thrust)
    if (boostMode === 'rocket') updateRocket(dt);
    else { stepPlayer(dt / 2); stepPlayer(dt / 2); }

    const dx = run.speed * dt;
    world += dx; run.dist += dx / K; cursor -= dx; boostStreamX -= dx;
    for (const o of obstacles) o.x -= dx;
    for (const o of orbs) { o.x -= dx; o.age += dt; }
    while (obstacles.length && obstacles[0].x + obstacles[0].w <= -30) releaseSprite(obstacles.shift());   // in place: no new array each frame
    for (let i = orbs.length - 1; i >= 0; i--) {
      if (orbs[i].x <= -30 - orbs[i].amp) {
        const dead = orbs.splice(i, 1)[0];
        if (orbPool.length < ORB_POOL_CAP) orbPool.push(dead);
      }
    }
    spawnObstacles();
    if (boostMode === 'rocket') spawnBoostCoins();

    p.hist.unshift(p.y);
    if (p.hist.length > 8) p.hist.pop();

    // coins
    const cx0 = PX, cx1 = PX + S, cy0 = p.y, cy1 = p.y + S;
    for (let i = orbs.length - 1; i >= 0; i--) {
      const o = orbs[i];
      const ox = coinX(o), r = o.mega ? 19 : (o.boost ? 13 : 15);
      const nx = clamp(ox, cx0, cx1), ny = clamp(o.y, cy0, cy1);
      if ((ox - nx) ** 2 + (o.y - ny) ** 2 < r * r) {
        orbs.splice(i, 1);
        collectCoin(o, ox);
        if (orbPool.length < ORB_POOL_CAP) orbPool.push(o);
      }
    }

    // obstacles
    const px0 = PX + 3, px1 = PX + S - 3, py0 = p.y + 3, py1 = p.y + S - 3;
    for (const o of (boostMode === 'off' && boostGrace <= 0 ? obstacles : [])) {   // blocks can't hurt the rocket
      if (hitsObstacle(o, px0, px1, py0, py1)) { crash('block'); return; }
    }

    // low-soul warning, then out of soul
    if (soul < 25 && !lowWarned) {
      lowWarned = true;
      sfxLow();
      startFuelSiren();
    }
    if (soul >= 25 && lowWarned) {
      lowWarned = false;
      stopFuelSiren();
    }
    if (soul <= 0) { soul = 0; crash('soul'); return; }
  }

