'use strict';

  // ---------- sprites: cosmetic player skins ----------
  // Price of each skin, in points. The first skin is the original look: free and always yours.
  // Skins only change how the player LOOKS. The hitbox and all gameplay stay exactly the same.
  const SPRITE_PRICES = [10000, 20000, 30000, 40000, 50000, 60000, 70000, 80000, 90000];
  const SPRITES = [
    { id: 'sunny', name: 'Sunny', price: 0, body: '#FFD23F', trail: '255,210,63', blurb: 'The original.', extra: null },
    { id: 'ember', name: 'Ember', price: SPRITE_PRICES[0], body: '#FF8A2B', hi: '#FFC38A', trail: '255,138,43', blurb: 'A little flame on top.', extra: 'flame' },
    { id: 'frost', name: 'Frost', price: SPRITE_PRICES[1], body: '#8FEFFF', hi: '#E9FCFF', trail: '143,239,255', blurb: 'Ice spikes, cool head.', extra: 'spikes' },
    { id: 'slime', name: 'Slime', price: SPRITE_PRICES[2], body: '#C6F03A', hi: '#EEFFA6', trail: '198,240,58', blurb: 'Antennae included.', extra: 'antennae' },
    { id: 'royal', name: 'Royal', price: SPRITE_PRICES[3], body: '#F4F1FF', hi: '#FFFFFF', trail: '244,241,255', blurb: 'Wears the crown.', extra: 'crown' },
    { id: 'golden', name: 'Golden', price: SPRITE_PRICES[4], body: '#FFE7A0', hi: '#FFFFFF', rim: '#E8B923', trail: '255,224,120', blurb: 'Halo and sparkle.', extra: 'halo' },
    { id: 'clown', name: 'Clown', price: SPRITE_PRICES[5], body: '#FFF1E8', hi: '#FFFFFF', trail: '255,241,232', blurb: 'Red nose, big grin.', face: 'clown', extra: 'clownhair' },
    { id: 'dapper', name: 'Dapper', price: SPRITE_PRICES[6], body: '#B8A2FF', hi: '#E4DAFF', trail: '184,162,255', blurb: 'Top hat and round specs.', face: 'glasses', extra: 'tophat' },
    { id: 'scrappy', name: 'Scrappy', price: SPRITE_PRICES[7], body: '#D9A066', hi: '#F0C79A', trail: '217,160,102', blurb: 'Battle scar, wild hair.', face: 'scar', extra: 'frizz' },
    { id: 'volt', name: 'Volt', price: SPRITE_PRICES[8], body: '#4DA6FF', hi: '#B8E0FF', trail: '77,166,255', blurb: 'Fully charged.', extra: 'volt' }
  ];
  for (const s of SPRITES) s.kind = 'sprite';
  UNLOCKABLES.push(...SPRITES);

  const spriteById = (id) => SPRITES.find((s) => s.id === id) || SPRITES[0];
  let SP = SPRITES[0];    // the skin you have equipped (restored from storage by initWallet)
  let spriteHead = 1;   // 1 = head up, -1 = head down; eases over when gravity flips so the extras flip with it

  function rrg(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }

  // Small extras drawn on the body of every skin except the original.
  function paintSpriteFinish(g, sp, x, y, w, h) {
    if (!sp.hi) return;
    const a0 = g.globalAlpha;
    g.fillStyle = sp.hi;
    g.globalAlpha = a0 * 0.65;
    g.fillRect(x + 4, y + 4, w * 0.3, 3);
    g.fillRect(x + 4, y + 4, 3, h * 0.22);
    g.globalAlpha = a0;
    if (sp.rim) {
      g.strokeStyle = sp.rim;
      g.lineWidth = 2;
      rrg(g, x + 1, y + 1, w - 2, h - 2, 7);
      g.stroke();
    }
  }

  // Draws the skin's head decoration. (0,0) is the body centre and the head is towards -y.
  // head = 1 (up) ... -1 (hanging down), so on the ceiling the crown hangs down too.
  function paintSpriteExtras(g, sp, cx, cy, w, h, head, t) {
    if (!sp.extra) return;
    const hw = w / 2, hh = h / 2;
    g.save();
    g.translate(cx, cy);
    g.scale(1, head);
    switch (sp.extra) {
      case 'flame': {
        const f = t ? 1 + Math.sin(t * 12) * 0.14 : 1;
        const tuft = (x, base, ht, col) => {
          g.fillStyle = col;
          g.beginPath();
          g.moveTo(x - base, -hh + 1);
          g.quadraticCurveTo(x - base * 0.9, -hh - ht * 0.55, x, -hh - ht);
          g.quadraticCurveTo(x + base * 0.9, -hh - ht * 0.55, x + base, -hh + 1);
          g.closePath();
          g.fill();
        };
        tuft(-9, 4.5, 9 * f, '#FF4D2E');
        tuft(9, 4.5, 9 * (2 - f), '#FF4D2E');
        tuft(0, 6.5, 15 * f, '#FF4D2E');
        tuft(0, 3.4, 8.5 * f, '#FFD23F');
        break;
      }
      case 'spikes': {
        for (const [x, b, ht] of [[-9.5, 6.5, 9], [0, 8, 14], [9.5, 6.5, 9]]) {
          g.fillStyle = '#E9FCFF';
          g.beginPath(); g.moveTo(x - b, -hh + 1); g.lineTo(x, -hh - ht); g.lineTo(x + b, -hh + 1); g.closePath(); g.fill();
          g.fillStyle = '#BDEFF9';
          g.beginPath(); g.moveTo(x, -hh + 1); g.lineTo(x, -hh - ht); g.lineTo(x + b, -hh + 1); g.closePath(); g.fill();
        }
        break;
      }
      case 'antennae': {
        g.lineCap = 'round';
        for (const s of [-1, 1]) {
          g.strokeStyle = '#7B9A16';
          g.lineWidth = 2.2;
          g.beginPath(); g.moveTo(s * 7, -hh + 1); g.lineTo(s * 11, -hh - 10); g.stroke();
          g.fillStyle = '#E9FF8F';
          g.beginPath(); g.arc(s * 11, -hh - 11, 3.2, 0, Math.PI * 2); g.fill();
          g.strokeStyle = '#7B9A16';
          g.lineWidth = 1.4;
          g.beginPath(); g.arc(s * 11, -hh - 11, 3.2, 0, Math.PI * 2); g.stroke();
        }
        break;
      }
      case 'crown': {
        const yb = -hh;
        g.fillStyle = '#FFC933';
        g.beginPath();
        g.moveTo(-9.5, yb + 1); g.lineTo(-9.5, yb - 12); g.lineTo(-4.8, yb - 6.5); g.lineTo(0, yb - 14);
        g.lineTo(4.8, yb - 6.5); g.lineTo(9.5, yb - 12); g.lineTo(9.5, yb + 1);
        g.closePath();
        g.fill();
        g.fillStyle = '#E8A800';
        g.fillRect(-9.5, yb - 3, 19, 4);
        g.fillStyle = '#FF5C93';
        g.beginPath(); g.arc(0, yb - 1, 1.5, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#5FD3FF';
        g.beginPath(); g.arc(-5.5, yb - 1, 1.3, 0, Math.PI * 2); g.fill();
        g.beginPath(); g.arc(5.5, yb - 1, 1.3, 0, Math.PI * 2); g.fill();
        break;
      }
      case 'halo': {
        const bob = t ? Math.sin(t * 3) * 1.4 : 0;
        g.lineWidth = 3.6;
        g.strokeStyle = '#E8B923';
        g.beginPath(); g.ellipse(0, -hh - 8 + bob, 11, 3.8, 0, 0, Math.PI * 2); g.stroke();
        g.lineWidth = 1.8;
        g.strokeStyle = '#FFF3B0';
        g.beginPath(); g.ellipse(0, -hh - 8 + bob, 11, 3.8, 0, 0, Math.PI * 2); g.stroke();
        const sx = hw - 2, sy = -hh + 4, r = 3 * (t ? 0.8 + 0.2 * Math.sin(t * 6) : 1);
        g.fillStyle = '#FFFFFF';
        g.beginPath();
        g.moveTo(sx, sy - r * 1.6); g.lineTo(sx + r * 0.5, sy - r * 0.5); g.lineTo(sx + r * 1.6, sy);
        g.lineTo(sx + r * 0.5, sy + r * 0.5); g.lineTo(sx, sy + r * 1.6); g.lineTo(sx - r * 0.5, sy + r * 0.5);
        g.lineTo(sx - r * 1.6, sy); g.lineTo(sx - r * 0.5, sy - r * 0.5);
        g.closePath();
        g.fill();
        break;
      }
      case 'clownhair': {
        // a puffy tuft of wig on each side of the head
        for (const sd of [-1, 1]) {
          const x0 = sd * 11.5, y0 = -hh - 1;
          g.fillStyle = '#E8482C';
          for (const [dx, dy, r] of [[0, 0, 6.2], [sd * 3.6, 3, 4.4], [-sd * 2.4, -4.2, 4.6]]) { g.beginPath(); g.arc(x0 + dx, y0 + dy, r, 0, Math.PI * 2); g.fill(); }
          g.fillStyle = '#FF8A5C';
          g.beginPath(); g.arc(x0 - sd * 1.6, y0 - 2.6, 2.1, 0, Math.PI * 2); g.fill();
        }
        break;
      }
      case 'tophat': {
        // a top hat with a gold band, set at a jaunty angle; a light edge keeps it readable on dark maps
        const yb = -hh;
        g.translate(0, yb);
        g.rotate(-0.1);
        g.fillStyle = '#343850';
        rrg(g, -8.5, -17, 17, 16, 2.5); g.fill();
        rrg(g, -13.5, -3.6, 27, 4.6, 2); g.fill();
        g.fillStyle = '#FFC933';
        g.fillRect(-8.5, -7, 17, 3.6);
        g.fillStyle = '#5A5F82';
        g.fillRect(-6.4, -15.4, 2.2, 7);
        g.strokeStyle = 'rgba(205,210,240,0.9)';
        g.lineWidth = 1;
        rrg(g, -8.5, -17, 17, 16, 2.5); g.stroke();
        rrg(g, -13.5, -3.6, 27, 4.6, 2); g.stroke();
        break;
      }
      case 'frizz': {
        // wild, frizzy hair: a cloud of curly tufts over the head that quivers a little, plus a few loose curls
        const puffs = [[-13, -hh + 1.5, 5.2], [-7.5, -hh - 3.5, 6], [0, -hh - 6.5, 6.6], [7.5, -hh - 4, 6], [13.5, -hh + 1.5, 5.2], [-3.5, -hh - 1, 5], [4, -hh - 0.5, 5]];
        const q = (i) => (t ? 1 + Math.sin(t * 7 + i * 1.7) * 0.06 : 1);
        g.fillStyle = '#8A4519';
        puffs.forEach(([x, y, r], i) => { g.beginPath(); g.arc(x + 0.8, y + 1.4, r * q(i), 0, Math.PI * 2); g.fill(); });
        g.fillStyle = '#C4692A';
        puffs.forEach(([x, y, r], i) => { g.beginPath(); g.arc(x, y, r * q(i), 0, Math.PI * 2); g.fill(); });
        g.fillStyle = '#E58F45';
        for (const [x, y, r] of puffs.slice(0, 5)) { g.beginPath(); g.arc(x - r * 0.3, y - r * 0.35, r * 0.34, 0, Math.PI * 2); g.fill(); }
        g.strokeStyle = '#C4692A';
        g.lineWidth = 2;
        g.lineCap = 'round';
        g.beginPath(); g.arc(-17.5, -hh - 4, 2.9, Math.PI * 0.3, Math.PI * 1.7); g.stroke();
        g.beginPath(); g.arc(17.8, -hh - 5, 2.9, Math.PI * 1.3, Math.PI * 2.7); g.stroke();
        g.beginPath(); g.arc(-2, -hh - 14, 2.6, Math.PI * 0.8, Math.PI * 2.2); g.stroke();
        break;
      }
      case 'volt': {
        // electrified: a soft glow, hair made of little lightning bolts, and short arcs that flicker off the body
        // (about 10 a second, re-rolled from a hash, so it is deterministic; with reduced motion it holds still)
        const slot = t ? Math.floor(t * 10) : 0, sd0 = slot * 131 + 7;
        g.fillStyle = 'rgba(120,225,255,0.13)';
        g.beginPath(); g.arc(0, 0, 27, 0, Math.PI * 2); g.fill();
        g.lineCap = 'round';
        g.lineJoin = 'round';
        [[-8.5, 1, 12], [0, -1, 16], [8.5, 1, 11]].forEach(([bx, sg, ht], i) => {
          const j = t ? (hash01(sd0 + 90 + i) - 0.5) * 2.4 : 0;
          g.beginPath();
          g.moveTo(bx, -hh + 1);
          g.lineTo(bx + 3.2 * sg, -hh - ht * 0.42);
          g.lineTo(bx - 1.8 * sg + j, -hh - ht * 0.62);
          g.lineTo(bx + 2.4 * sg + j, -hh - ht);
          g.strokeStyle = 'rgba(120,225,255,0.5)'; g.lineWidth = 4; g.stroke();
          g.strokeStyle = '#FFF27A'; g.lineWidth = 2.2; g.stroke();
          g.strokeStyle = '#FFFFFF'; g.lineWidth = 0.9; g.stroke();
        });
        for (let i = 0; i < 3; i++) {
          if (t && hash01(sd0 + i * 17) < 0.3) continue;
          const a = hash01(sd0 + i * 53 + 3) * Math.PI * 2, dx = Math.cos(a), dy = Math.sin(a);
          const x0 = dx * (hw + 0.5), y0 = dy * (hh + 0.5), len = 8 + hash01(sd0 + i * 29) * 8;
          g.beginPath();
          g.moveTo(x0, y0);
          for (let k = 1; k <= 3; k++) {
            const f = k / 3, jit = (hash01(sd0 + i * 71 + k) - 0.5) * 7 * Math.sin(Math.PI * f);
            g.lineTo(x0 + dx * len * f - dy * jit, y0 + dy * len * f + dx * jit);
          }
          g.strokeStyle = 'rgba(120,225,255,0.45)'; g.lineWidth = 3.4; g.stroke();
          g.strokeStyle = '#F4FDFF'; g.lineWidth = 1.1; g.stroke();
        }
        break;
      }
    }
    g.restore();
  }

  // Face details for the skins that have them (clown make-up, glasses, a scar). They are drawn in the body's own frame
  // (origin at the body centre, +y towards the feet, flipped with gravity exactly like the eyes) so they stay on the
  // eyes; the head extras above ease over when gravity flips, the face does not. Skins without a face are untouched.
  function paintSpriteFace(g, sp, cx, cy, w, h, dir) {
    if (!sp.face) return;
    const e1 = -0.16 * w, e2 = 0.22 * w, ey = 3, hw = w / 2, mid = (e1 + e2) / 2;
    g.save();
    g.translate(cx, cy);
    g.scale(1, dir);
    g.lineCap = 'round';
    g.lineJoin = 'round';
    switch (sp.face) {
      case 'clown': {
        g.fillStyle = 'rgba(232,72,60,0.4)';                    // rosy cheeks
        for (const cxp of [e1 - 6.2, e2 + 5.6]) { g.beginPath(); g.arc(cxp, ey + 6.4, 2.7, 0, Math.PI * 2); g.fill(); }
        g.fillStyle = '#3E8BFF';                                 // diamonds of eye make-up
        for (const e of [e1, e2]) {
          g.beginPath();
          g.moveTo(e, ey - 12); g.lineTo(e + 2.8, ey - 8); g.lineTo(e, ey - 4.6); g.lineTo(e - 2.8, ey - 8);
          g.closePath(); g.fill();
        }
        g.strokeStyle = '#D7263D';                               // the big grin
        g.lineWidth = 1.9;
        g.beginPath(); g.moveTo(mid - 7.4, ey + 9.6); g.quadraticCurveTo(mid, ey + 14.6, mid + 7.4, ey + 9.6); g.stroke();
        g.fillStyle = '#FF3B3B';                                 // and the red nose
        g.beginPath(); g.arc(mid, ey + 6.6, 3.7, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#FFFFFF'; g.globalAlpha = 0.85;
        g.beginPath(); g.arc(mid - 1.2, ey + 5.4, 1.1, 0, Math.PI * 2); g.fill();
        g.globalAlpha = 1;
        break;
      }
      case 'glasses': {
        g.strokeStyle = '#E8B923';                               // arms to the sides of the head
        g.lineWidth = 1.6;
        g.beginPath();
        g.moveTo(e1 - 5.4, ey - 0.6); g.lineTo(-hw + 0.5, ey - 1.2);
        g.moveTo(e2 + 5.4, ey - 0.6); g.lineTo(hw - 0.5, ey - 1.2);
        g.stroke();
        for (const e of [e1, e2]) {                              // a light tint over each eye, in a gold frame
          g.fillStyle = 'rgba(214,242,255,0.5)';
          g.beginPath(); g.arc(e, ey, 5.6, 0, Math.PI * 2); g.fill();
          g.strokeStyle = '#E8B923'; g.lineWidth = 1.7; g.stroke();
          g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 1;
          g.beginPath(); g.arc(e, ey, 3.9, Math.PI * 1.12, Math.PI * 1.5); g.stroke();
        }
        g.strokeStyle = '#E8B923'; g.lineWidth = 1.5;
        g.beginPath(); g.moveTo(e1 + 5.5, ey - 1.4); g.quadraticCurveTo(mid, ey - 3.6, e2 - 5.5, ey - 1.4); g.stroke();
        break;
      }
      case 'scar': {
        const x0 = e1 - 6.4, y0 = ey - 9.5, x1 = e1 + 1.8, y1 = ey + 9.5;    // a raised scar slanting across the rear eye
        g.strokeStyle = '#8E2F3D'; g.lineWidth = 2.7;
        g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
        g.strokeStyle = '#E37A85'; g.lineWidth = 1.2;
        g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
        const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy), nx = -dy / len, ny = dx / len;
        g.strokeStyle = '#FBE9DC'; g.lineWidth = 1.1;              // stitch marks
        g.beginPath();
        for (const f of [0.22, 0.5, 0.78]) {
          const px = x0 + dx * f, py = y0 + dy * f;
          g.moveTo(px - nx * 2.7, py - ny * 2.7); g.lineTo(px + nx * 2.7, py + ny * 2.7);
        }
        g.stroke();
        break;
      }
    }
    g.restore();
  }

  // Preview picture for a skin card: the skin standing on a floor.
  function drawSpriteThumb(cv, sp) {
    const g = cv.getContext('2d');
    if (!g) return;
    const th = MAPS[0].theme;
    g.setTransform(cv.width / 88, 0, 0, cv.height / 64, 0, 0);
    g.fillStyle = th.ink; g.fillRect(0, 0, 88, 64);
    g.fillStyle = 'rgba(255,255,255,0.12)';
    for (const [dx, dy] of [[10, 12], [34, 20], [60, 10], [80, 26], [20, 34], [70, 40], [46, 42]]) { g.beginPath(); g.arc(dx, dy, 1.8, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = th.deep; g.fillRect(0, 54, 88, 10);
    const w = 34, h = 34, x = 44 - w / 2, y = 54 - h;
    g.fillStyle = th.pshadow; rrg(g, x + 3, y + 3, w, h, 8); g.fill();
    g.fillStyle = sp.body; rrg(g, x, y, w, h, 8); g.fill();
    paintSpriteFinish(g, sp, x, y, w, h);
    g.fillStyle = th.deep;
    g.beginPath(); g.arc(x + w * 0.34, y + h / 2 + 3, 3.6, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.arc(x + w * 0.72, y + h / 2 + 3, 3.6, 0, Math.PI * 2); g.fill();
    paintSpriteFace(g, sp, 44, y + h / 2, w, h, 1);
    paintSpriteExtras(g, sp, 44, y + h / 2, w, h, 1, 0);
  }

  // ----- the sprites screen -----
  function refreshSpriteCards() {
    spriteTotal.textContent = fmtNum(points);
    for (const card of spriteList.children) paintCard(card, spriteById(card.dataset.sprite), card.dataset.sprite === SP.id);
  }
  function buildSpriteCards() {
    if (!spriteList.children.length) for (const s of SPRITES) spriteList.appendChild(makeCard('sprite', s));
    spriteMsg.textContent = '';
    refreshSpriteCards();
  }

  function equipSprite(s) {
    SP = s;
    store.set('flipside-sprite', s.id);
  }

  spriteList.addEventListener('click', (e) => {
    const card = e.target.closest('.spritecard');
    if (!card) return;
    const s = spriteById(card.dataset.sprite);
    if (isOwned(s)) {
      cancelConfirm();
      equipSprite(s);
      refreshSpriteCards();
      spriteMsg.textContent = s.name + ' equipped.';
      revealSpriteCard(card);
      return;
    }
    buyTap(s, card, spriteMsg, refreshSpriteCards, equipSprite);   // a new skin is equipped right away
    revealSpriteCard(card);
  });

