'use strict';

  // ---------- state ----------
  let state = 'menu';   // menu | maps | sprites | settings | playing | paused | over
  let clock = 0, world = 0;
  const p = { y: 0, vy: 0, dir: 1, grounded: true, squash: 0, buffer: 0, hist: [] };
  let obstacles = [], orbs = [], parts = [];
  let run = { t: 0, dist: 0, bonus: 0, speed: 0 };
  let cursor = 0, nextSide = 'floor', sameRun = 0;
  let shake = 0, finalScore = 0, isNewBest = false, overlayReady = false, crashClock = 0;
  let soul = 100, soulFlash = 0, lowWarned = false, deathReason = 'block', lastMegaT = -999;
  let floaters = [];
  let boostMode = 'off', boostT = 0, boostUses = 0, boostReady = true, boostCd = 0, boostCdTotal = 0;
  let boostCombo = 0, boostGrace = 0, boostStreamX = 0, speedMul = 1, rocketFxAcc = 0;
  let scoreRight = 0, botY = 0;

  const score = () => Math.floor(run.dist / 40) + run.bonus;
  // scroll speed without the boost, so level spacing stays fair whatever the rocket is doing
  const baseSpeed = () => (BASE + 340 * Math.min(1, run.t / 70)) * K;

  function resetRun() {
    spriteHead = 1;
    for (const o of obstacles) releaseSprite(o);
    for (const o of orbs) if (orbPool.length < ORB_POOL_CAP) orbPool.push(o);
    for (const q of parts) if (partPool.length < PART_POOL_CAP) partPool.push(q);
    obstacles = []; orbs = []; parts = [];
    run = { t: 0, dist: 0, bonus: 0, speed: BASE * K, banked: 0 };
    p.dir = 1; p.y = BOT - S; p.vy = 0; p.grounded = true;
    p.squash = 0; p.buffer = 0; p.hist.length = 0;
    cursor = W + 220 * K; nextSide = 'floor'; sameRun = 0;
    shake = 0; isNewBest = false; overlayReady = false;
    soul = 100; soulFlash = 0; lowWarned = false; deathReason = 'block'; lastMegaT = -999;
    for (const f of floaters) if (floaterPool.length < FLOATER_POOL_CAP) floaterPool.push(f);
    floaters = [];
    boostMode = 'off'; boostT = 0; boostUses = 0; boostCombo = 0; boostGrace = 0; boostStreamX = 0; speedMul = 1; rocketFxAcc = 0;
    boostReady = BOOST_FIRST_READY <= 0;
    boostCd = boostReady ? 0 : BOOST_FIRST_READY;
    boostCdTotal = boostCd;
  }

