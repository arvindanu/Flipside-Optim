'use strict';

  // ----- map preview thumbnails -----
  function drawMapThumb(cv, m) {
    const g = cv.getContext('2d');
    if (!g) return;
    const Wt = 330, Ht = 193, top = 34, bot = 159, th = m.theme;
    g.setTransform(cv.width / Wt, 0, 0, cv.height / Ht, 0, 0);
    g.fillStyle = th.ink; g.fillRect(0, 0, Wt, Ht);
    g.fillStyle = th.hill;
    g.beginPath(); g.arc(70, 120, 60, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.arc(250, 70, 48, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.12)';
    for (let y = top + 16, row = 0; y < bot; y += 30, row++) {
      for (let x = (row % 2) * 15 + 6; x < Wt; x += 30) { g.beginPath(); g.arc(x, y, 2.2, 0, Math.PI * 2); g.fill(); }
    }
    const rng = mulberry32(m.id === 'forest' ? 7 : m.id === 'rocky' ? 21 : 3);
    const items = [{ x: 58, w: 66, h: 92, side: 'floor', kind: 'pine' }, { x: 204, w: 60, h: 80, side: 'ceil', kind: 'oak' }];
    for (const o of items) {
      if (m.style) {
        o.look = LOOKS[m.style](o.w, o.h, rng, o.kind);
        paintObstacle(g, o, top, bot, th);
      } else {
        const y = o.side === 'floor' ? bot - o.h : top;
        g.fillStyle = 'rgba(20,26,122,0.55)'; g.fillRect(o.x + 7, y + 7, o.w, o.h);
        g.fillStyle = C.pink; g.fillRect(o.x, y, o.w, o.h);
        g.fillStyle = C.blush;
        if (o.side === 'floor') g.fillRect(o.x, y, o.w, 10); else g.fillRect(o.x, y + o.h - 10, o.w, 10);
      }
    }
    if (m.style === 'coil') {                          // a frozen crackle at each terminal, so the preview reads as electric
      g.lineJoin = 'round';
      items.forEach((o, i) => {
        const L = o.look, dir = o.side === 'floor' ? -1 : 1, sx = i ? -1 : 1;
        const bx = o.x + L.cx, by = o.side === 'floor' ? bot - L.ballMid : top + L.ballMid;
        g.fillStyle = th.arc; g.globalAlpha = 0.16;
        g.beginPath(); g.arc(bx, by, L.br * 2.6, 0, Math.PI * 2); g.fill();
        g.beginPath();
        g.moveTo(bx, by + dir * L.br);
        for (const [dx, dd] of [[7, 12], [-3, 22], [10, 32], [2, 44], [9, 56]]) g.lineTo(bx + dx * sx, by + dir * (L.br + dd));
        g.moveTo(bx - 3 * sx, by + dir * (L.br + 22));
        g.lineTo(bx - 15 * sx, by + dir * (L.br + 30));
        g.strokeStyle = th.arc; g.lineWidth = 5; g.globalAlpha = 0.3; g.stroke();
        g.strokeStyle = th.arcCore; g.lineWidth = 1.8; g.globalAlpha = 1; g.stroke();
      });
    } else if (m.style === 'lighthouse') {              // a soft static sweep from each lamp, so the preview reads as a beacon
      items.forEach((o) => {
        const L = o.look, by = o.side === 'floor' ? bot - L.lampMid : top + L.lampMid, bx = o.x + L.cx;
        g.fillStyle = th.beam;
        g.globalAlpha = 0.18;
        g.beginPath();
        g.moveTo(bx, by); g.lineTo(bx + 130, by - 26); g.lineTo(bx + 130, by + 26);
        g.closePath(); g.fill();
        g.globalAlpha = 1;
      });
    }
    g.fillStyle = th.deep;
    g.fillRect(0, 0, Wt, top);
    g.fillRect(0, bot, Wt, Ht - bot);
    g.strokeStyle = C.pink; g.globalAlpha = 0.9; g.lineWidth = 2.5;
    g.beginPath(); g.arc(160, (top + bot) / 2, 14, 0, Math.PI * 2); g.stroke();
    g.globalAlpha = 1;
    g.fillStyle = C.blush;
    g.beginPath(); g.arc(160, (top + bot) / 2, 9, 0, Math.PI * 2); g.fill();
  }

