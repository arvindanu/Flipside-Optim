'use strict';

  // ---------- particles ----------
  // A burst re-uses spent particle objects instead of creating new ones (the rocket alone spawns an exhaust
  // spark every single frame it flies, so this is the single biggest source of garbage in a long session).
  const PART_POOL_CAP = 160;
  let partPool = [];
  function burst(x, y, n, colors, speed, life, bias) {
    for (let i = 0; i < n; i++) {
      const q = partPool.pop() || {};
      q.x = x; q.y = y;
      q.vx = (Math.random() - 0.5) * speed * 2 + (bias || 0);
      q.vy = (Math.random() - 0.5) * speed * 2;
      q.life = life; q.max = life;
      q.s = rand(3, 8);
      q.c = colors[i % colors.length];
      parts.push(q);
    }
  }
  function updateParticles(dt) {
    for (let i = parts.length - 1; i >= 0; i--) {
      const q = parts[i];
      q.x += q.vx * dt; q.y += q.vy * dt;
      q.vx *= 1 - Math.min(1, 2.2 * dt);
      q.vy *= 1 - Math.min(1, 2.2 * dt);
      q.life -= dt;
      if (q.life <= 0) {
        parts.splice(i, 1);
        if (partPool.length < PART_POOL_CAP) partPool.push(q);
      }
    }
  }

