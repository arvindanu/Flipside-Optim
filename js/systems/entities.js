'use strict';

  // ---------- coins and soul ----------
  // A coin's x is its scrolling position plus a left/right sway that grows as the run goes on.
  const coinX = (o) => o.x + (o.amp ? Math.sin(o.age * o.freq + o.phase) * o.amp : 0);

  // Coins are pooled too: every field is set explicitly on reuse so nothing leaks from whatever the
  // recycled object used to be (a boost coin becoming a stale "boost:true" regular coin, say).
  const ORB_POOL_CAP = 80;
  let orbPool = [];
  function spawnCoin(cx) {
    const prog = clamp((run.t - COIN_SWAY_START) / COIN_SWAY_RAMP, 0, 1);
    const mega = run.t > 8 && run.t - lastMegaT > MEGA_COOLDOWN && Math.random() < MEGA_CHANCE;
    if (mega) lastMegaT = run.t;
    const o = orbPool.pop() || {};
    o.x = cx;
    o.y = (TOP + BOT) / 2;
    o.mega = mega;
    o.boost = false;
    o.amp = prog > 0 ? prog * COIN_SWAY_TIME * baseSpeed() : 0;
    o.freq = lerp(2.0, 3.0, prog);
    o.phase = rand(0, Math.PI * 2);
    o.age = 0;
    orbs.push(o);
  }

  function collectCoin(o, ox) {
    if (o.boost) {
      boostCombo++;
      run.bonus += BOOST_COIN_POINTS;
      soul = Math.min(100, soul + BOOST_COIN_SOUL);
      if (soul > 35) { lowWarned = false; stopFuelSiren(); }
      burst(ox, o.y, 5, [C.sun, C.blush], 120, 0.35, 0);
      sfxBoostCoin(boostCombo);
      return;
    }
    if (o.mega) {
      soul = 100;
      run.bonus += MEGA_POINTS;
      burst(ox, o.y, 28, [C.sun, C.blush, C.pink], 340, 0.7, 0);
      spawnFloater(ox, o.y - 24, 'SOUL FULL', 1.2, true);
      sfxMega();
    } else {
      soul = Math.min(100, soul + SOUL_COIN_GAIN);
      run.bonus += ORB_POINTS;
      burst(ox, o.y, 12, [C.blush, C.sun, C.pink], 220, 0.5, 0);
      spawnFloater(ox, o.y - 24, '+' + SOUL_COIN_GAIN + '%', 0.9, false);
      sfxOrb();
    }
    soulFlash = 0.35;
    if (soul > 35) { lowWarned = false; stopFuelSiren(); }
  }

  const FLOATER_POOL_CAP = 16;
  let floaterPool = [];
  function spawnFloater(x, y, text, life, big) {
    const f = floaterPool.pop() || {};
    f.x = x; f.y = y; f.text = text; f.life = life; f.max = life; f.big = !!big;
    floaters.push(f);
  }
  function updateFloaters(dt) {
    for (let i = floaters.length - 1; i >= 0; i--) {
      const f = floaters[i];
      f.life -= dt;
      f.y -= 60 * dt;
      if (f.life <= 0) {
        floaters.splice(i, 1);
        if (floaterPool.length < FLOATER_POOL_CAP) floaterPool.push(f);
      }
    }
  }

  // ---------- boost (booster rocket) ----------
  // The rocket follows a gentle wave through the middle of the screen; its coins sit on the same wave.
  const boostPathY = (wx) => (TOP + BOT) / 2 + Math.sin(wx * (Math.PI * 2 / 560)) * CORR * 0.16;

  function tryBoost() {
    if (state !== 'playing') return;
    if (boostMode === 'off' && !boostReady) {
      spawnFloater(W / 2, (TOP + BOT) / 2 + 40, 'Boost ready in ' + fmtTime(boostCd), 1.1, false);
      return;
    }
    activateBoost();
  }

  function activateBoost() {
    if (state !== 'playing' || !boostReady || boostMode !== 'off') return;
    boostMode = 'rocket';
    boostT = 0;
    boostReady = false;
    boostUses++;
    boostCd = BOOST_COOLDOWNS[Math.min(boostUses, BOOST_COOLDOWNS.length) - 1];   // 2 min, then 5 min, then 10 min
    boostCdTotal = boostCd;
    boostCombo = 0;
    boostStreamX = PX + S + 220 * K;
    p.grounded = false; p.vy = 0; p.buffer = 0;
    burst(PX + S / 2, p.y + S / 2, 16, [C.sun, C.pink, C.blush], 260, 0.5, -run.speed * 0.4);
    sfxBoost();
  }

  function spawnBoostCoins() {
    const spacing = BOOST_COIN_SPACING * K;
    while (boostStreamX < W + 40 && boostT + (boostStreamX - PX) / run.speed < BOOST_DURATION - 0.15) {
      const wx = world + (boostStreamX - PX);
      const o = orbPool.pop() || {};
      o.x = boostStreamX; o.y = boostPathY(wx); o.mega = false; o.boost = true; o.amp = 0; o.freq = 0; o.phase = 0; o.age = 0;
      orbs.push(o);
      boostStreamX += spacing;
    }
  }

  function updateRocket(dt) {
    boostT += dt;
    const targetY = boostPathY(world) - S / 2;
    const prev = p.y;
    p.y += (targetY - p.y) * (1 - Math.exp(-dt * 14));
    p.vy = (p.y - prev) / Math.max(dt, 0.001);
    if (!reduce) burst(PX + S / 2 - 32, p.y + S / 2, 1, [C.sun, C.pink], 50, 0.3, -run.speed * 0.5);   // exhaust sparks
    if (boostT >= BOOST_DURATION) {
      // keep flying until there is a clear stretch ahead, then come down safely
      const ahead = obstacles.find((o) => o.x + o.w > PX - 2);
      // judged at normal speed, because that's the pace you come back down to
      const clear = !ahead || (ahead.x - (PX + S)) / Math.max(baseSpeed() * 1.15, 1) >= 0.45;
      if (clear || boostT >= BOOST_DURATION + 2.5) beginLanding(ahead);
    }
  }

  // Land on the wall that is safe from the next block.
  function beginLanding(ahead) {
    boostMode = 'landing';
    p.dir = ahead ? (ahead.side === 'floor' ? -1 : 1) : (p.y + S / 2 < (TOP + BOT) / 2 ? -1 : 1);
    p.vy = 0; p.grounded = false; p.buffer = 0;
  }

  function updateBoostTimer(dt) {
    if (boostGrace > 0) boostGrace -= dt;
    if (!boostReady) {
      boostCd -= dt;
      if (boostCd <= 0) {
        boostCd = 0;
        boostReady = true;
        spawnFloater(W / 2, (TOP + BOT) / 2 - 80, 'BOOST READY', 1.4, true);
        sfxBoostReady();
      }
    }
  }

