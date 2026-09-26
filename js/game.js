
(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const stage = $('stage'), canvas = $('game'), ctx = canvas.getContext('2d', { alpha: false });
  const overlay = $('overlay'), ovTitle = $('ovTitle'), ovText = $('ovText');
  const ovStats = $('ovStats'), ovBtn = $('ovBtn'), ovSound = $('ovSound');
  const pauseBtn = $('pauseBtn'), probe = $('probe');
  const boostBtn = $('boostBtn'), boostRing = $('boostRing'), boostLbl = $('boostLbl');
  const mapOverlay = $('mapOverlay'), mapList = $('mapList'), mapTotal = $('mapTotal');
  const mapMsg = $('mapMsg'), mapPlay = $('mapPlay'), mapBack = $('mapBack'), ovMaps = $('ovMaps');
  const homeMenu = $('homeMenu'), homeMaps = $('homeMaps'), homeSprites = $('homeSprites'), homeSettings = $('homeSettings');
  const spriteOverlay = $('spriteOverlay'), spriteList = $('spriteList'), spriteTotal = $('spriteTotal');
  const spriteMsg = $('spriteMsg'), spriteBack = $('spriteBack');
  const settingsOverlay = $('settingsOverlay'), setSound = $('setSound'), setSoundLbl = $('setSoundLbl'), setSoundDesc = $('setSoundDesc'), setBack = $('setBack');
  const setMusic = $('setMusic'), setMusicLbl = $('setMusicLbl'), setMusicDesc = $('setMusicDesc');

  const C = { ink: '#2431D6', deep: '#141A7A', pink: '#FF5C93', blush: '#FFE3EC', sun: '#FFD23F' };
  const FONT = '"Bricolage Grotesque", system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif';

  const S = 34;            // player size
  const BAND = 48;         // minimum wall thickness
  const CORR_MAX = 800;    // tallest corridor (extra height on tall phones becomes wall)
  const G0 = 5200, V0 = 1500, KICK0 = 160;   // physics tuned for a 444px corridor
  const BASE = 380;        // starting scroll speed
  const ORB_POINTS = 40;
  const MEGA_POINTS = 150;

  // ---- Soul (fuel) tuning: the meter runs from 0 to 100 ----
  const SOUL_DRAIN_START = 3.8;   // points lost per second at the start of a run
  const SOUL_DRAIN_END = 5.8;     // points lost per second at full difficulty (about 70 seconds in)
  const SOUL_DRAIN_LATE = 2.4;    // extra points per second added slowly between 70 and 170 seconds
  const SOUL_COIN_GAIN = 50;      // a normal coin refuels half of the meter
  const COIN_SWAY_START = 15;     // seconds into a run before coins start moving left and right
  const COIN_SWAY_RAMP = 60;      // seconds it takes the sway to reach full strength
  const COIN_SWAY_TIME = 0.18;    // full-strength sway distance, measured in seconds of scrolling
  const MEGA_CHANCE = 0.09;       // chance that a coin turns out to be a mega coin
  const MEGA_COOLDOWN = 20;       // minimum seconds between two mega coins

  // ---- Boost (booster rocket) tuning ----
  const BOOST_COOLDOWNS = [120, 300, 600];  // seconds until the boost refreshes after use #1, use #2, and use #3 onwards (2 min, 5 min, 10 min)
  const BOOST_FIRST_READY = 0;              // seconds into a run before the first boost is ready (0 = ready straight away, 120 = after 2 minutes)
  const BOOST_DURATION = 5;                 // seconds of rocket flight
  const BOOST_SPEED = 1.55;                 // how much faster the world scrolls during a boost
  const BOOST_COIN_POINTS = 12;             // score for each coin along the rocket's path
  const BOOST_COIN_SOUL = 10;               // soul refuelled by each of those coins (percent)
  const BOOST_COIN_SPACING = 150;           // distance between those coins

  const rand = (a, b) => a + Math.random() * (b - a);
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  const reduceMq = window.matchMedia('(prefers-reduced-motion: reduce)');
  let reduce = reduceMq.matches;
  if (reduceMq.addEventListener) reduceMq.addEventListener('change', (e) => { reduce = e.matches; });

  // ---------- storage (always guarded) ----------
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, String(v)); } catch (e) { /* ignore */ }
    }
  };
  let best = parseInt(store.get('flipside-best') || '0', 10) || 0;
  let soundOn = store.get('flipside-sound') !== 'off';
  let musicOn = store.get('flipside-music') !== 'off';   // music only; sound effects follow soundOn alone

  // ---------- YouTube Playables integration ----------
  // YouTube provides the ad experience. Outside YouTube, these calls are no-ops.
  const ytInPlayables = () => typeof ytgame !== 'undefined' && !!ytgame.IN_PLAYABLES_ENV;
  let ytAudioEnabled = true;
  let ytExternallyPaused = false;
  let ytWasPlayingBeforePause = false;
  let ytReadyNotified = false;
  let ytGameReadyNotified = false;
  let ytAdBusy = false;

  function ytHandleAudio(enabled) {
    ytAudioEnabled = !!enabled;
    if (!ytAudioEnabled) {
      pauseMusic();
    } else if (soundOn && state === 'playing') {
      startMusic();
    }
  }

  function ytRequestInterstitialThenStart() {
    if (ytAdBusy) return;
    ytAdBusy = true;

    const start = () => {
      ytAdBusy = false;
      startRun();
    };

    if (!ytInPlayables() || !ytgame.ads || typeof ytgame.ads.requestInterstitialAd !== 'function') {
      start();
      return;
    }

    ytgame.ads.requestInterstitialAd()
      .catch(() => {})
      .finally(start);
  }

  function ytInit() {
    if (typeof ytgame === 'undefined') return;

    try {
      ytAudioEnabled = !!ytgame.system.isAudioEnabled();
      ytgame.system.onAudioEnabledChange(ytHandleAudio);
      ytgame.system.onPause(() => {
        ytExternallyPaused = true;
        ytWasPlayingBeforePause = state === 'playing';
        if (ytWasPlayingBeforePause) pause();
        else pauseMusic();
      });
      ytgame.system.onResume(() => {
        if (!ytExternallyPaused) return;
        ytExternallyPaused = false;
        if (ytWasPlayingBeforePause && state === 'paused') resume();
        else if (ytAudioEnabled && soundOn) startMusic();
        ytWasPlayingBeforePause = false;
      });
    } catch (e) { /* Playables SDK may be unavailable outside YouTube. */ }
  }

  ytInit();

  // ---------- maps ----------
  // Prices, in points. Points come from your runs and are SPENT when you buy something.
  // The original map is free and always yours.
  const FOREST_PRICE = 10000;
  const ROCKY_PRICE = 20000;
  const CITY_PRICE = 35000;
  const DAWN_PRICE = 60000;
  const LAVA_PRICE = 85000;
  const GLACIER_PRICE = 100000;
  const TESLA_PRICE = 120000;
  const OCEAN_PRICE = 130000;
  const LIGHTHOUSE_PRICE = 1000;

  // Mix two #rrggbb colours; t is the share of a.
  const mixHex = (a, b, t) => {
    const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
    const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
    return 'rgb(' + pa.map((v, i) => Math.round(v * t + pb[i] * (1 - t))).join(',') + ')';
  };
  const fmtNum = (n) => String(Math.max(0, Math.floor(n))).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const mulberry32 = (a) => () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const MAPS = [
    {
      id: 'classic', name: 'Classic', price: 0, style: null,
      blurb: 'The original pink blocks.',
      theme: { ink: '#2431D6', deep: '#141A7A', hill: 'rgba(20,26,122,0.32)', pshadow: 'rgba(20,26,122,0.7)', scrim: 'rgba(20,26,122,0.62)' }
    },
    {
      id: 'forest', name: 'Forest', price: FOREST_PRICE, style: 'forest',
      blurb: 'Pine and oak trees.',
      theme: {
        ink: '#1C6B57', deep: '#0C3A30', hill: 'rgba(8,50,40,0.34)', pshadow: 'rgba(8,40,32,0.7)', scrim: 'rgba(8,52,42,0.62)',
        leaf: '#5CCB6E', leafShade: '#2E9A54', leafLight: '#B4F58F', trunk: '#9A6238', trunkShade: '#6A4024'
      }
    },
    {
      id: 'rocky', name: 'Rocky', price: ROCKY_PRICE, style: 'rocky',
      blurb: 'Jagged boulders.',
      theme: {
        ink: '#553F8E', deep: '#2A1D52', hill: 'rgba(28,16,64,0.34)', pshadow: 'rgba(24,14,54,0.7)', scrim: 'rgba(38,24,78,0.62)',
        rock: '#A89A8E', rockShade: '#77695F', rockLight: '#D8CCBF', crack: '#4A3F39'
      }
    },
    {
      id: 'city', name: 'N-City', price: CITY_PRICE, style: 'city',
      blurb: 'Skyscrapers under city lights.',
      theme: {
        ink: '#12143A', deep: '#08091C', hill: 'rgba(40,110,150,0.26)', pshadow: 'rgba(8,9,25,0.74)', scrim: 'rgba(11,12,32,0.64)',
        skyFar: 'rgba(35,32,90,0.85)', winFar: 'rgba(255,201,102,0.55)',
        body: '#333A66', bodyShade: '#20244A', bodyLight: '#4E5890',
        windowLit: '#FFC966', windowCool: '#9FE8FF', antenna: '#C9CFE6', antennaLight: '#FF5C5C'
      }
    },
    {
      id: 'dawn', name: 'The 7AM', price: DAWN_PRICE, style: 'dawn',
      blurb: 'Steam pipes at first light.',
      theme: {
        ink: '#5B4A52', deep: '#2E2229', hill: 'rgba(255,158,102,0.24)', pshadow: 'rgba(15,10,13,0.72)', scrim: 'rgba(24,17,22,0.64)',
        pipe: '#B5714A', pipeShade: '#7A4A2E', pipeLight: '#D99B6E',
        flange: '#4A4640', rivet: '#D8D2C4', steam: '#FFF7EB'
      }
    },
    {
      id: 'lava', name: 'Magma', price: LAVA_PRICE, style: 'lava',
      blurb: 'Molten blocks under ash skies.',
      theme: {
        ink: '#2A1310', deep: '#120807', hill: 'rgba(255,96,32,0.15)', pshadow: 'rgba(10,4,3,0.75)', scrim: 'rgba(24,9,7,0.66)',
        crust: '#7A4030', crustShade: '#4A2119', crustLight: '#A65A40',
        lava: '#FF6A1F', lavaHot: '#FFC83D',
        mountFar: 'rgba(16,7,6,0.72)', craterGlow: 'rgba(255,128,48,0.85)', ember: '#FF9A4D'
      }
    },
    {
      id: 'glacier', name: 'Glaciers', price: GLACIER_PRICE, style: 'ice',
      blurb: 'Ice spires in drifting snow.',
      theme: {
        ink: '#4F7EAC', deep: '#16304F', hill: 'rgba(255,255,255,0.16)', pshadow: 'rgba(12,30,54,0.62)', scrim: 'rgba(16,38,66,0.66)',
        ice: '#D9F1FF', iceShade: '#8FCBEE', iceLight: '#FFFFFF', iceEdge: '#1F4E7C',
        snow: '#FFFFFF', peakLight: 'rgba(255,255,255,0.26)', peakShade: 'rgba(214,234,250,0.13)'
      }
    },
    {
      id: 'tesla', name: 'Tesla', price: TESLA_PRICE, style: 'coil',
      blurb: 'Crackling coils and lightning.',
      theme: {
        ink: '#0A0E2C', deep: '#04061A', hill: 'rgba(100,120,255,0.19)', pshadow: 'rgba(2,3,14,0.78)', scrim: 'rgba(6,8,32,0.68)',
        coilBody: '#4D5AA8', coilLight: '#A9B6F2', coilShade: '#1D2558', coilMetal: '#3A4690',
        chrome: '#E4EAFF', chromeShade: '#8B96CF', copper: '#E8A04A',
        arc: '#7DF9FF', arcCore: '#F2FDFF', violet: '#B48CFF'
      }
    },
    {
      id: 'ocean', name: 'Ocean', price: OCEAN_PRICE, style: 'ocean',
      blurb: 'Kelp forests and coral in the deep blue.',
      theme: {
        ink: '#0B4A6B', deep: '#052537', hill: 'rgba(8,58,80,0.34)', pshadow: 'rgba(4,26,38,0.7)', scrim: 'rgba(7,46,64,0.62)',
        weed: '#2FA27A', weedShade: '#1B6B52', weedLight: '#8CE9C0', stem: '#1F5B46',
        coralPalette: [
          { base: '#FF6F91', shade: '#C94A6C', light: '#FFC2D4' },
          { base: '#FF9F45', shade: '#D97328', light: '#FFD9A8' },
          { base: '#9B87FF', shade: '#6B57D6', light: '#D6CCFF' },
          { base: '#4FD3C4', shade: '#2B9C8F', light: '#B4F3EA' }
        ],
        polyp: '#FFF6DE', bubble: 'rgba(216,248,255,0.9)', ray: 'rgba(190,240,255,0.09)', sandFar: 'rgba(18,80,96,0.3)'
      }
    },
    {
      id: 'lighthouse', name: 'Lighthouse', price: LIGHTHOUSE_PRICE, style: 'lighthouse',
      blurb: 'Lighthouses on a moonlit coast.',
      theme: {
        ink: '#0A1B33', deep: '#040B18', hill: 'rgba(110,145,195,0.14)', pshadow: 'rgba(4,10,20,0.72)', scrim: 'rgba(10,27,51,0.62)',
        tower: '#E8E1CE', towerShade: '#9C9480', towerLight: '#FFFBF0', band: '#262A34',
        rail: '#3A3F4A', glass: '#FFD27A', glassCore: '#FFF3C4', roof: '#3E4756', roofShade: '#242A33',
        beam: '#FFE9A8', beamCore: '#FFF7DD', star: '#EAF2FF', mist: '#B9C9DE', islandFar: 'rgba(6,14,26,0.6)'
      }
    }
  ];
  for (const m of MAPS) m.theme.shadowSolid = mixHex(m.theme.deep, m.theme.ink, 0.55);
  const UNLOCKABLES = [];   // everything you can buy with points: maps and sprites
  for (const m of MAPS) { m.kind = 'map'; UNLOCKABLES.push(m); }

  const mapById = (id) => MAPS.find((m) => m.id === id) || MAPS[0];
  // ---------- wallet: your points and what you own ----------
  // Points are earned from runs and SPENT on maps and sprites. What you own is a saved record (not something worked
  // out from your balance), so spending points can never take an unlock away. The balance and the owned list are
  // saved together in ONE write, so they can never disagree, even if the app is closed mid-purchase.
  const WALLET_KEY = 'flipside-wallet';
  let points = 0;                    // spendable balance
  const owned = new Set();           // ids of everything you have bought (the free originals are always in here)
  const hinted = new Set();          // items already announced as "you can now afford this", so it never nags
  const isOwned = (m) => owned.has(m.id);
  let currentMap = MAPS[0];          // the map you last played (restored from storage by initWallet)
  let pickMap = MAPS[0];             // the card highlighted on the selection screen
  let T = MAPS[0].theme;             // colours of the map on screen

  function applyTheme(m) {
    T = m.theme;
    C.ink = T.ink;
    C.deep = T.deep;
    const rs = document.documentElement.style;
    rs.setProperty('--ink', T.ink);
    rs.setProperty('--deep', T.deep);
    rs.setProperty('--scrim', T.scrim);
  }
  applyTheme(currentMap);

  function saveWallet() {
    store.set(WALLET_KEY, JSON.stringify({ v: 1, points, owned: Array.from(owned), hinted: Array.from(hinted) }));
  }

  // Spend points on an item. Returns 'ok', 'owned' or 'poor'. Nothing changes unless it returns 'ok'.
  function buy(item) {
    if (owned.has(item.id)) return 'owned';
    if (!(points >= item.price)) return 'poor';
    points -= item.price;
    owned.add(item.id);
    saveWallet();
    return 'ok';
  }

  // Every run adds its score to your points. Already-banked points are remembered so pausing,
  // leaving the app or crashing can never count the same points twice.
  function bankRun() {
    const s = score();
    const d = s - (run.banked || 0);
    if (d > 0) {
      points += d;
      run.banked = s;
      saveWallet();
    }
  }

  // Items you could not afford before but can now. Each one is announced once, so it never becomes nagging.
  function takeNewAffordable() {
    const fresh = UNLOCKABLES.filter((u) => u.price > 0 && !owned.has(u.id) && points >= u.price && !hinted.has(u.id));
    if (fresh.length) {
      fresh.forEach((u) => hinted.add(u.id));
      saveWallet();
    }
    return fresh;
  }
  const listNames = (a) => (a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1]);
  const affordText = (fresh) => 'You can now buy ' + listNames(fresh.map((u) => u.name + (u.kind === 'map' ? ' map' : ' sprite'))) + '!';

  // Load the wallet. Runs once, after the maps AND the sprites exist.
  function initWallet() {
    let loaded = false;
    const raw = store.get(WALLET_KEY);
    if (raw) {
      try {
        const w = JSON.parse(raw);
        if (w && typeof w === 'object') {
          points = Number.isFinite(w.points) ? Math.max(0, Math.floor(w.points)) : 0;
          if (Array.isArray(w.owned)) for (const id of w.owned) owned.add(id);
          if (Array.isArray(w.hinted)) for (const id of w.hinted) hinted.add(id);
          loaded = true;
        }
      } catch (e) { loaded = false; }
    }
    if (!loaded) {
      // First launch with purchases. The old running total becomes your points, and anything it had already
      // unlocked stays yours for free (nobody loses a map or skin they were already using).
      const legacy = Math.max(0, parseInt(store.get('flipside-total') || '0', 10) || 0);
      points = legacy;
      for (const u of UNLOCKABLES) if (u.price <= legacy) owned.add(u.id);
    }
    for (const u of UNLOCKABLES) if (u.price === 0) owned.add(u.id);            // the originals are always yours
    for (const id of Array.from(owned)) if (!UNLOCKABLES.some((u) => u.id === id)) owned.delete(id);   // forget unknown ids
    if (!loaded) saveWallet();

    currentMap = mapById(store.get('flipside-map') || 'classic');
    if (!isOwned(currentMap)) currentMap = MAPS[0];
    pickMap = currentMap;
    applyTheme(currentMap);
    SP = spriteById(store.get('flipside-sprite') || 'sunny');
    if (!isOwned(SP)) SP = SPRITES[0];
  }

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

  // ----- buying: shared by the Maps and Sprites screens -----
  const CONFIRM_MS = 3500;        // how long the "tap again" question stays open
  const CONFIRM_MIN_MS = 450;     // a second tap sooner than this is a double-tap, not a confirmation
  let confirmId = null, confirmAt = 0, confirmTimer = 0;
  function cancelConfirm() { confirmId = null; clearTimeout(confirmTimer); confirmTimer = 0; }

  // What a card shows: 'owned', 'locked' (cannot afford yet), 'buy' (can afford) or 'confirm' (asked to confirm).
  function cardMode(item) {
    if (owned.has(item.id)) return 'owned';
    if (points < item.price) return 'locked';
    return confirmId === item.id ? 'confirm' : 'buy';
  }

  function makeCard(kind, item) {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = kind === 'map' ? 'mapcard' : 'spritecard';
    card.dataset[kind] = item.id;
    card.setAttribute('role', 'radio');
    const tail =
      '<span class="mapneed"></span><span class="mapdesc"></span>' +
      '<span class="mapbar"><i></i></span><span class="mapprog"></span>';
    card.innerHTML = kind === 'map'
      ? '<canvas class="mapthumb" width="232" height="136" aria-hidden="true"></canvas>' +
        '<span class="mapinfo"><span class="maphead"><span class="mapname">' + item.name + '</span><span class="mapstate"></span><span class="mapsel">Live</span></span>' + tail + '</span>'
      : '<canvas class="spritethumb" width="176" height="128" aria-hidden="true"></canvas>' +
        '<span class="maphead"><span class="mapname">' + item.name + '</span></span>' +
        '<span class="maphead"><span class="mapstate"></span><span class="mapsel">Live</span></span>' + tail;
    card._r = {
      state: card.querySelector('.mapstate'), need: card.querySelector('.mapneed'), desc: card.querySelector('.mapdesc'),
      bar: card.querySelector('.mapbar'), fill: card.querySelector('.mapbar i'), prog: card.querySelector('.mapprog'), pill: '', label: ''
    };
    if (kind === 'map') drawMapThumb(card.querySelector('canvas'), item); else drawSpriteThumb(card.querySelector('canvas'), item);
    return card;
  }

  const setText = (el, t) => { if (el.textContent !== t) el.textContent = t; };

  // Bring one card up to date with the wallet. Only touches the page when something actually changed.
  function paintCard(card, item, picked) {
    const r = card._r, mode = cardMode(item), kindWord = item.kind === 'map' ? 'map' : 'sprite';
    let pill, cls, need, desc = '';
    if (mode === 'owned') { pill = 'Unlocked'; cls = 'on'; need = item.price > 0 ? 'Purchased' : 'Always unlocked'; desc = item.blurb; }
    else if (mode === 'locked') { pill = LOCK_SVG + 'Locked'; cls = 'off'; need = 'Costs ' + fmtNum(item.price) + ' points'; }
    else if (mode === 'buy') { pill = 'Buy'; cls = 'buy'; need = 'Costs ' + fmtNum(item.price) + ' points'; desc = 'Tap to buy'; }
    else { pill = 'Confirm?'; cls = 'confirm'; need = 'Costs ' + fmtNum(item.price) + ' points'; desc = 'Tap again to spend them'; }
    card.classList.toggle('locked', mode === 'locked');
    card.classList.toggle('buy', mode === 'buy');
    card.classList.toggle('confirm', mode === 'confirm');
    card.classList.toggle('picked', picked);
    card.setAttribute('aria-checked', picked ? 'true' : 'false');
    if (r.pill !== pill) { r.pill = pill; r.state.innerHTML = pill; }
    if (r.state.className !== 'mapstate ' + cls) r.state.className = 'mapstate ' + cls;
    setText(r.need, need);
    setText(r.desc, desc);
    r.desc.hidden = !desc;
    const showBar = mode === 'locked';
    r.bar.hidden = !showBar; r.prog.hidden = !showBar;
    if (showBar) {
      r.fill.style.width = Math.min(100, Math.floor((points / item.price) * 100)) + '%';
      setText(r.prog, fmtNum(points) + ' / ' + fmtNum(item.price));
    }
    const label = item.name + ' ' + kindWord + ', ' + (mode === 'owned' ? 'unlocked' : mode === 'locked' ? 'locked' : 'available to buy') + '. ' + need + '.';
    if (r.label !== label) { r.label = label; card.setAttribute('aria-label', label); }
  }

  function shakeCard(card) { card.classList.remove('shake'); void card.offsetWidth; card.classList.add('shake'); }

  // A tap on something you do not own yet: not enough points -> say so; first tap -> ask; second tap -> buy.
  function buyTap(item, card, msg, refresh, onBought) {
    const now = Date.now();
    if (points < item.price) {
      cancelConfirm();
      msg.textContent = 'Not enough points for ' + item.name + '. You need ' + fmtNum(item.price - points) + ' more.';
      shakeCard(card);
      refresh();
      return;
    }
    if (confirmId !== item.id) {
      confirmId = item.id; confirmAt = now;
      clearTimeout(confirmTimer);
      confirmTimer = setTimeout(() => { confirmId = null; msg.textContent = ''; refresh(); }, CONFIRM_MS);
      msg.textContent = 'Tap ' + item.name + ' again to spend ' + fmtNum(item.price) + ' points.';
      refresh();
      return;
    }
    if (now - confirmAt < CONFIRM_MIN_MS) return;
    cancelConfirm();
    if (buy(item) !== 'ok') { msg.textContent = 'Could not buy ' + item.name + '.'; refresh(); return; }
    onBought(item);
    msg.textContent = item.name + ' unlocked for ' + fmtNum(item.price) + ' points. ' + fmtNum(points) + ' points left.';
    refresh();
  }

  // ----- the map selection screen -----
  const LOCK_SVG = '<svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true"><path fill="currentColor" d="M17 9V7a5 5 0 0 0-10 0v2H5v12h14V9h-2zm-8 0V7a3 3 0 0 1 6 0v2H9z"/></svg>';

  function refreshMapCards() {
    mapTotal.textContent = fmtNum(points);
    for (const card of mapList.children) paintCard(card, mapById(card.dataset.map), card.dataset.map === pickMap.id);
  }
  // The cards are made once and reused every time the screen opens.
  function buildMapCards() {
    if (!mapList.children.length) for (const m of MAPS) mapList.appendChild(makeCard('map', m));
    mapMsg.textContent = '';
    refreshMapCards();
  }

  function showMaps() {
    if (state !== 'menu' && state !== 'over') return;
    state = 'maps';
    cancelConfirm();
    stopMusic();
    resetRun();
    setUi();
    pickMap = currentMap;
    applyTheme(pickMap);
    buildMapCards();
    overlay.hidden = true;
    mapOverlay.hidden = false;
    scrollPickedIntoView();
  }

  // After a tap the card can change height (it grows when it turns to "Unlocked"), so keep it fully in view.
  function revealCard(card) {
    const l = mapList.getBoundingClientRect(), c = card.getBoundingClientRect();
    if (c.bottom > l.bottom - 10) mapList.scrollTop += c.bottom - (l.bottom - 10);   // 10px and 6px are the list's own padding
    else if (c.top < l.top + 6) mapList.scrollTop -= l.top + 6 - c.top;
  }

  // With more maps than fit on screen, open the list with the selected one in view (does nothing if it all fits).
  function scrollPickedIntoView() {
    const card = mapList.querySelector('.mapcard.picked');
    if (!card) return;
    const l = mapList.getBoundingClientRect(), c = card.getBoundingClientRect();
    mapList.scrollTop += (c.top + c.height / 2) - (l.top + l.height / 2);
  }

  // Same two helpers as above, for the sprite grid. Kept separate (rather than sharing one function with an
  // element argument) so nothing about the existing map list's behaviour changes.
  function revealSpriteCard(card) {
    const l = spriteList.getBoundingClientRect(), c = card.getBoundingClientRect();
    if (c.bottom > l.bottom - 10) spriteList.scrollTop += c.bottom - (l.bottom - 10);
    else if (c.top < l.top + 6) spriteList.scrollTop -= l.top + 6 - c.top;
  }
  function scrollPickedSpriteIntoView() {
    const card = spriteList.querySelector('.spritecard.picked');
    if (!card) return;
    const l = spriteList.getBoundingClientRect(), c = card.getBoundingClientRect();
    spriteList.scrollTop += (c.top + c.height / 2) - (l.top + l.height / 2);
  }

  function playPicked() {
    if (state !== 'maps' || !isOwned(pickMap)) return;
    cancelConfirm();
    currentMap = pickMap;
    store.set('flipside-map', currentMap.id);
    applyTheme(currentMap);
    startRun();
  }

  function backFromMaps() {
    if (state !== 'maps') return;
    cancelConfirm();
    applyTheme(currentMap);
    toMenu();
  }

  mapList.addEventListener('click', (e) => {
    const card = e.target.closest('.mapcard');
    if (!card) return;
    const m = mapById(card.dataset.map);
    if (isOwned(m)) {
      cancelConfirm();
      pickMap = m;
      applyTheme(m);
      refreshMapCards();
      mapMsg.textContent = m.name + ' selected.';
      revealCard(card);
      return;
    }
    buyTap(m, card, mapMsg, refreshMapCards, (item) => { pickMap = item; applyTheme(item); });   // a new map is selected right away
    revealCard(card);
  });
  mapPlay.addEventListener('click', playPicked);
  mapBack.addEventListener('click', backFromMaps);
  ovMaps.addEventListener('click', () => { if (state === 'over' && overlayReady) showMaps(); });

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

  // ----- settings -----
  function syncSoundUi() {
    ovSound.textContent = soundOn ? 'Sound on' : 'Sound off';
    setSound.setAttribute('aria-checked', soundOn ? 'true' : 'false');
    setSound.classList.toggle('on', soundOn);
    setSoundLbl.textContent = soundOn ? 'On' : 'Off';
    setSoundDesc.textContent = ytInPlayables() && !ytAudioEnabled ? 'Muted by YouTube right now' : 'Music and sound effects';
    syncMusicUi();
  }

  // The Music switch follows the Sound switch: with Sound off there is nothing to hear, so it is greyed out.
  function syncMusicUi() {
    setMusic.setAttribute('aria-checked', musicOn ? 'true' : 'false');
    setMusic.classList.toggle('on', musicOn);
    setMusic.disabled = !soundOn;
    setMusicLbl.textContent = musicOn ? 'On' : 'Off';
    setMusicDesc.textContent = soundOn ? 'Turn off to keep sound effects only' : 'Turn Sound on to hear music';
  }

  // One switch for the pause menu and the Settings screen.
  function toggleSound() {
    soundOn = !soundOn;
    store.set('flipside-sound', soundOn ? 'on' : 'off');
    syncSoundUi();
    if (soundOn) {
      audio();
      ensureMusic();
      beep(520, 780, 0.08, 'square', 0.055);
      if (state === 'playing') startMusic();
      else pauseMusic();
    } else {
      pauseMusic();
    }
  }

  // Mutes or restores the music only. Sound effects are not touched, so a short blip confirms they still play.
  function toggleMusic() {
    if (!soundOn) return;
    musicOn = !musicOn;
    store.set('flipside-music', musicOn ? 'on' : 'off');
    syncMusicUi();
    if (musicOn) {
      ensureMusic();
      beep(520, 780, 0.08, 'square', 0.055);
      if (state === 'playing') startMusic();
      else pauseMusic();
    } else {
      pauseMusic();
      beep(780, 520, 0.08, 'square', 0.055);
    }
  }

  // ----- home menu and screen flow -----
  const HOME_PLAY_OPENS_MAP_SELECT = false;   // true = Play on the home page opens the map screen first (the earlier flow)
  const inMenus = () => state === 'menu' || state === 'maps' || state === 'sprites' || state === 'settings';

  function playFromHome() {
    if (HOME_PLAY_OPENS_MAP_SELECT) { showMaps(); return; }
    startRun();                       // uses the map and sprite you last chose
  }

  function showSprites() {
    if (state !== 'menu') return;
    state = 'sprites';
    cancelConfirm();
    buildSpriteCards();
    overlay.hidden = true;
    spriteOverlay.hidden = false;
    scrollPickedSpriteIntoView();
  }

  function showSettings() {
    if (state !== 'menu') return;
    state = 'settings';
    syncSoundUi();
    overlay.hidden = true;
    settingsOverlay.hidden = false;
  }

  function backToHome() {
    if (state === 'sprites' || state === 'settings') { cancelConfirm(); toMenu(); }
  }

  homeMaps.addEventListener('click', showMaps);
  homeSprites.addEventListener('click', showSprites);
  homeSettings.addEventListener('click', showSettings);
  spriteBack.addEventListener('click', backToHome);
  setBack.addEventListener('click', backToHome);
  setSound.addEventListener('click', toggleSound);
  setMusic.addEventListener('click', toggleMusic);

  initWallet();

  // ---------- layout: the canvas always fills the whole screen ----------
  let W = 0, H = 0, K = 1, TOP = BAND, BOT = 0, PX = 0, CORR = 0, FLIGHT = 0.4;
  let G = G0, VMAX = V0, KICK = KICK0;
  let scx = 1, scy = 1, sx = 1, sy = 1;            // canvas scale, and css px per logical px
  let hudY = 24, hudL = 20, hudR = 60, insB = 0;
  const BOOST_BTN_ALIGN = 'right';   // where the boost button sits in the bottom wall: 'right' or 'center'
  let lastCssW = 0, lastCssH = 0;
  // Canvas resolution. Phones get a pixel budget, and the game lowers it by itself if a phone can't hold about 45 fps.
  const PIXEL_BUDGET = 1.1e6;   // canvas pixels we aim for
  const DPR_MIN = 0.8;          // never go blurrier than this
  let qual = 1, curDpr = 1, lastLayerKey = '', lite = false;
  function dprFor(q, cssW, cssH) {
    const dev = window.devicePixelRatio || 1;
    const base = Math.min(dev, 2, Math.max(1, Math.sqrt(PIXEL_BUDGET / (cssW * cssH))));
    return clamp(base * q, DPR_MIN, 2);
  }

  function readInsets() {
    let cs = null;
    try { cs = getComputedStyle(probe); } catch (e) { /* ignore */ }
    const n = (v) => parseFloat(v) || 0;
    return cs ? { t: n(cs.paddingTop), r: n(cs.paddingRight), b: n(cs.paddingBottom), l: n(cs.paddingLeft) }
              : { t: 0, r: 0, b: 0, l: 0 };
  }

  function layout() {
    const cssW = Math.max(1, window.innerWidth);
    const cssH = Math.max(1, window.innerHeight);
    lastCssW = cssW; lastCssH = cssH;
    const aspect = cssW / cssH;

    // Landscape keeps a 540-tall world and gets wider; portrait keeps a 540-wide world and gets taller.
    const nW = aspect >= 1 ? Math.round(540 * aspect) : 540;
    const nH = aspect >= 1 ? 540 : Math.round(540 / aspect);
    const big = W === 0 || Math.abs(nW - W) / W > 0.12 || Math.abs(nH - H) / H > 0.12;

    if (big) {
      W = nW; H = nH; K = W / 960;
      CORR = Math.min(H - 2 * BAND, CORR_MAX);
      TOP = Math.round((H - CORR) / 2);
      BOT = TOP + CORR;
      PX = Math.round(W * 0.2);
      // scale physics with corridor height so a flip always takes the same time
      const Vk = (CORR - S) / 410;
      G = G0 * Vk; VMAX = V0 * Vk; KICK = KICK0 * Vk;
      FLIGHT = Math.sqrt(2 * (CORR - S) / G);
    }

    const dpr = dprFor(qual, cssW, cssH);
    const cw = Math.round(cssW * dpr), ch = Math.round(cssH * dpr);
    if (canvas.width !== cw) canvas.width = cw;        // setting the size clears and re-allocates the canvas, so only when it really changed
    if (canvas.height !== ch) canvas.height = ch;
    curDpr = dpr;
    scx = canvas.width / W; scy = canvas.height / H;
    sx = cssW / W; sy = cssH / H;
    const layerKey = scx + '|' + scy + '|' + W + '|' + H + '|' + TOP + '|' + BOT;
    if (layerKey !== lastLayerKey) { lastLayerKey = layerKey; spriteGen++; spritePool.length = 0; }   // cached sprites no longer fit

    // HUD row and the pause button share one line near the top
    const ins = readInsets();
    insB = ins.b;
    const bandCss = TOP * sy;
    const btn = clamp(Math.round(bandCss * 0.75), 32, 44);
    const hudCssY = Math.min(bandCss / 2, Math.max(ins.t + btn / 2 + 8, 34 + btn / 2));
    hudY = hudCssY / sy;
    hudL = (ins.l + 16) / sx;
    hudR = (ins.r + 10 + btn + 14) / sx;
    pauseBtn.style.width = btn + 'px';
    pauseBtn.style.height = btn + 'px';
    pauseBtn.style.top = Math.round(hudCssY - btn / 2) + 'px';
    pauseBtn.style.right = Math.round(ins.r + 10) + 'px';

    // bottom row: best score on the left, boost button on the right
    // The bottom wall is otherwise empty, so the boost button fills it: as tall as the wall allows, with a little breathing room.
    const bandBotCss = (H - BOT) * sy;
    const room = Math.max(20, bandBotCss - ins.b);
    const pad = clamp(room * 0.09, 5, 12);
    let bb = clamp(Math.round(room - 2 * pad), 34, 118);
    if (bb > room - 1) bb = Math.max(24, Math.floor(room - 1));
    botY = BOT + room / 2 / sy;
    boostBtn.style.width = bb + 'px';
    boostBtn.style.height = bb + 'px';
    boostBtn.style.setProperty('--bb', bb + 'px');
    boostBtn.style.top = Math.round(BOT * sy + (room - bb) / 2) + 'px';
    if (BOOST_BTN_ALIGN === 'center') {
      boostBtn.style.right = 'auto';
      boostBtn.style.left = Math.round(cssW / 2 - bb / 2) + 'px';
    } else {
      boostBtn.style.left = 'auto';
      boostBtn.style.right = Math.round(ins.r + Math.max(10, pad)) + 'px';
    }

    return big;
  }

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
  let boostCombo = 0, boostGrace = 0, boostStreamX = 0, speedMul = 1;
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
    boostMode = 'off'; boostT = 0; boostUses = 0; boostCombo = 0; boostGrace = 0; boostStreamX = 0; speedMul = 1;
    boostReady = BOOST_FIRST_READY <= 0;
    boostCd = boostReady ? 0 : BOOST_FIRST_READY;
    boostCdTotal = boostCd;
  }

  // ---------- audio ----------
  let actx = null;
  let sfxMaster = null;
  let compressor = null;
  let music = null;

  // Master SFX volume. The original SFX were quite quiet.
  const SFX_VOLUME = 2.0;

  // Background music volume. The supplied track is already mastered fairly loud.
  const MUSIC_VOLUME = 0.18;

  // Create the HTML audio element independently from Web Audio. If Web Audio
  // fails on a particular WebView, background music must still be able to play.
  function ensureMusic() {
    if (music) return music;
    try {
      const src = new URL('music.mp3', window.location.href).href;
      music = new Audio(src);
      music.loop = true;
      music.preload = 'auto';
      music.autoplay = false;
      music.volume = MUSIC_VOLUME;
      music.muted = false;
      music.setAttribute('playsinline', '');
      music.addEventListener('error', () => {
        console.warn('Flipside: music.mp3 could not be loaded:', music.error);
      });
      music.load();
    } catch (e) {
      music = null;
    }
    return music;
  }

  function audio() {
    if (!soundOn || (ytInPlayables() && !ytAudioEnabled)) return null;

    // Always prepare the music element, even if Web Audio is unavailable.
    ensureMusic();

    if (!actx) {
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) throw new Error('Web Audio API unavailable');
        actx = new AC();

        // Separate SFX master bus.
        sfxMaster = actx.createGain();
        sfxMaster.gain.value = SFX_VOLUME;

        // Smooths peaks so louder SFX stay clear instead of becoming harsh.
        compressor = actx.createDynamicsCompressor();
        compressor.threshold.value = -10;
        compressor.knee.value = 8;
        compressor.ratio.value = 3;
        compressor.attack.value = 0.003;
        compressor.release.value = 0.12;

        sfxMaster.connect(compressor);
        compressor.connect(actx.destination);
      } catch (e) {
        // Do not destroy the HTML music player if Web Audio is unavailable.
        actx = null;
        sfxMaster = null;
        compressor = null;
      }
    }

    if (actx && actx.state === 'suspended') {
      actx.resume().catch(() => {});
    }

    return actx;
  }

  function startMusic() {
    if (!soundOn || !musicOn || (ytInPlayables() && !ytAudioEnabled)) return;

    const a = audio();
    if (a && a.state === 'suspended') {
      a.resume().catch(() => {});
    }

    const m = ensureMusic();
    if (!m) return;

    // This function is reached from a real Play/Resume tap, so playback is
    // inside the user's gesture on Android WebView.
    m.volume = MUSIC_VOLUME;
    m.muted = false;
    const promise = m.play();
    if (promise && typeof promise.catch === 'function') {
      promise.catch((e) => {
        console.warn('Flipside: background music could not start:', e);
      });
    }
  }

  function pauseMusic() {
    if (music) music.pause();
  }

  function stopMusic() {
    if (music) {
      music.pause();
      try { music.currentTime = 0; } catch (e) { /* ignore */ }
    }
  }

  function beep(f0, f1, dur, type, vol) {
    const a = audio();
    if (!a || !sfxMaster) return;

    try {
      const t = a.currentTime;
      const o = a.createOscillator();
      const g = a.createGain();

      o.type = type;
      o.frequency.setValueAtTime(f0, t);
      o.frequency.exponentialRampToValueAtTime(
        Math.max(20, f1),
        t + dur
      );

      // Short attack makes SFX cleaner and avoids an audible click.
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0001, vol), t + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);

      o.connect(g);
      g.connect(sfxMaster);

      o.start(t);
      o.stop(t + dur + 0.03);
    } catch (e) { /* ignore */ }
  }

  const sfxFlip = () =>
    (p.dir === -1
      ? beep(300, 640, 0.09, 'square', 0.055)
      : beep(640, 300, 0.09, 'square', 0.055));

  const sfxLand = () =>
    beep(170, 90, 0.07, 'sine', 0.11);

  const sfxOrb = () => {
    beep(880, 1300, 0.1, 'triangle', 0.085);
    setTimeout(() => beep(1300, 1760, 0.12, 'triangle', 0.085), 70);
  };

  const sfxCrash = () =>
    beep(240, 40, 0.5, 'sawtooth', 0.11);

  // Mega coin: three rising notes.
  const sfxMega = () => {
    beep(660, 990, 0.11, 'triangle', 0.09);
    setTimeout(() => beep(990, 1480, 0.11, 'triangle', 0.09), 80);
    setTimeout(() => beep(1480, 2200, 0.16, 'triangle', 0.09), 160);
  };
  // Soul ran out: a slow power-down.
  const sfxSoulOut = () => beep(360, 45, 0.75, 'triangle', 0.12);
  // Soul is getting low.
  const sfxLow = () => beep(540, 400, 0.14, 'sine', 0.1);

  // Retro ambulance-style fuel warning: classic fast HI-LO "wee-woo".
  // The two tones alternate in the same rhythm as the low-fuel blink.
  let fuelSirenOn = false;
  let fuelSirenTimer = null;
  const FUEL_SIREN_STEP = 0.38;
  function fuelSirenPulse() {
    if (!soundOn || !fuelSirenOn) return;
    beep(820, 820, 0.17, 'square', 0.085);
    setTimeout(() => {
      if (!fuelSirenOn) return;
      beep(560, 560, 0.17, 'square', 0.085);
    }, 175);
  }
  function startFuelSiren() {
    if (fuelSirenOn) return;
    fuelSirenOn = true;
    fuelSirenPulse();
    fuelSirenTimer = setInterval(fuelSirenPulse, FUEL_SIREN_STEP * 1000);
  }
  function stopFuelSiren() {
    fuelSirenOn = false;
    if (fuelSirenTimer) clearInterval(fuelSirenTimer);
    fuelSirenTimer = null;
  }
  // Boost: launch whoosh, a rising blip for each rocket coin, and a chime when it refreshes.
  const sfxBoost = () => {
    beep(160, 720, 0.45, 'sawtooth', 0.08);
    setTimeout(() => beep(420, 1500, 0.3, 'square', 0.05), 60);
  };
  const sfxBoostCoin = (n) => {
    const k = Math.min(n, 14) * 50;
    beep(760 + k, 1000 + k, 0.06, 'triangle', 0.08);
  };
  const sfxBoostReady = () => {
    beep(700, 1000, 0.1, 'triangle', 0.09);
    setTimeout(() => beep(1000, 1500, 0.14, 'triangle', 0.09), 90);
  };

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

  // ---------- cached sprites ----------
  // Every tree or rock never changes once made, so it is painted once and then copied to the screen each frame.
  // (Measured: copying three cached sprites is 3 to 9 times cheaper than repainting their shapes.)
  const mkCanvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  let spriteGen = 0, spritePool = [];

  // One reusable off-screen canvas per tree/rock currently on screen, all the same size, recycled as they scroll away.
  function spriteFor(o) {
    if (o.sprite && o.spriteGen === spriteGen) return o.sprite;
    const wK = Math.max(0.8, K);
    const cw = Math.ceil((98 * wK + 12) * scx), ch = Math.ceil((CORR * 0.68 + 12) * scy);
    let cv = spritePool.pop();
    if (!cv) cv = mkCanvas(cw, ch);
    const g = cv.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, cv.width, cv.height);
    g.setTransform(scx, 0, 0, scy, 0, 0);
    paintObstacle(g, { x: 0, w: o.w, h: o.h, side: o.side, look: o.look }, 0, o.h, T);
    o.sprite = cv; o.spriteGen = spriteGen;
    return cv;
  }
  function releaseSprite(o) {
    if (o.sprite && o.spriteGen === spriteGen && spritePool.length < 16) spritePool.push(o.sprite);
    o.sprite = null;
  }

  // ---------- drawing ----------
  // Cached font strings and the SOUL label's measured width: real work only when the screen scale changes.
  let fontCacheGen = -1;
  let fontHudLab = '', fontHudNum = '', fontSoulLab = '', fontSoulNum = '', fontHint = '', fontFloatBig = '', fontFloatSmall = '', soulLabelW = 0;
  function refreshFontCache() {
    if (fontCacheGen === spriteGen) return;
    fontCacheGen = spriteGen;
    const u = 1 / sy;
    fontHudLab = '600 ' + Math.round(17 * u) + 'px ' + FONT;
    fontHudNum = '800 ' + Math.round(20 * u) + 'px ' + FONT;
    fontSoulLab = '800 ' + Math.round(12 * u) + 'px ' + FONT;
    fontSoulNum = '800 ' + Math.round(24 * u) + 'px ' + FONT;
    fontHint = '600 ' + Math.round(18 / sy) + 'px ' + FONT;
    fontFloatBig = '800 ' + Math.round(22 / sy) + 'px ' + FONT;
    fontFloatSmall = '800 ' + Math.round(18 / sy) + 'px ' + FONT;
    ctx.font = fontSoulLab;
    soulLabelW = ctx.measureText('SOUL').width;
  }
  // setLineDash() copies whatever array it is given, so one shared array can be reused every frame
  // instead of allocating a fresh [26, 18] / [9, 9] / [] literal each time these run.
  const DASH_WALL = [26, 18], DASH_MEGA = [9, 9], DASH_NONE = [];
  function rr(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function circle(x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }

  // A night skyline in place of the soft hill-blobs the other maps use. Anchored to both walls (like real
  // buildings), since this game's floor and ceiling are symmetric. Deterministic (no Math.random): the same
  // pattern scrolls past every time, it does not reshuffle every frame. Plain fillRects only, no clipping or
  // paths, so this costs less per frame than the 4 blurred hill circles it replaces.
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
      for (let i = pass; i < n; i += 2) {
        const r = pass ? 1.8 + (i % 3) * 0.8 : 1 + (i % 3) * 0.5;
        const sway = reduce ? 0 : Math.sin(clock * 1.4 + i * 1.7) * (3 + (i % 4));
        const x = ((((i * 83) % span) - world * (0.12 + (i % 5) * 0.03) + sway) % span + span) % span - 30;
        const rise = 24 + (i % 4) * 9;
        const y = BOT - ((((i * 71) + (reduce ? 0 : clock * rise)) % CORR) + CORR) % CORR;
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      }
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
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    const gs = 44;
    const off = (world * 0.3) % gs;
    let row = 0;
    for (let y = TOP + gs / 2; y < BOT; y += gs, row++) {
      const shift = (row % 2) * gs / 2;
      for (let x = -off - shift; x < W + gs; x += gs) circle(x, y, 2.6);
    }
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

  // ---------- ui ----------
  let boostUiCls = '', boostUiPct = -1, boostUiSec = -2;
  function fmtTime(sec) {
    const t = Math.max(0, Math.ceil(sec));
    return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0');
  }
  function updateBoostUi() {
    if (boostBtn.hidden) return;
    let cls, pct;
    if (boostMode !== 'off') {
      cls = 'active';
      pct = boostMode === 'rocket' ? clamp(1 - boostT / BOOST_DURATION, 0, 1) : 0;
    } else if (boostReady) {
      cls = 'ready'; pct = 1;
    } else {
      cls = 'cool';
      pct = boostCdTotal > 0 ? clamp(1 - boostCd / boostCdTotal, 0, 1) : 1;
    }
    const pctKey = Math.round(pct * 200);
    const sec = cls === 'cool' ? Math.max(0, Math.ceil(boostCd)) : -1;   // fmtTime()'s own rounding, mirrored here so this catches every change it would
    if (cls === boostUiCls && pctKey === boostUiPct && sec === boostUiSec) return;   // nothing a player could see has changed - build nothing
    boostUiCls = cls; boostUiPct = pctKey; boostUiSec = sec;
    const lbl = cls === 'active' ? 'GO!' : cls === 'ready' ? 'BOOST' : fmtTime(boostCd);
    const aria = cls === 'cool' ? 'Boost, ready in ' + lbl : cls === 'ready' ? 'Boost, ready' : 'Boost active';
    boostBtn.className = 'boostbtn ' + cls;
    boostLbl.textContent = lbl;
    boostRing.style.strokeDashoffset = (289 * (1 - pct)).toFixed(1);
    boostBtn.setAttribute('aria-label', aria);
  }

  function setUi() {
    pauseBtn.hidden = state !== 'playing';
    boostBtn.hidden = state !== 'playing';
    ovSound.textContent = soundOn ? 'Sound on' : 'Sound off';
  }

  function showOverlay(kind) {
    overlay.hidden = false;
    ovStats.hidden = true;
    ovText.hidden = false;
    ovSound.hidden = true;
    ovMaps.hidden = true;
    mapOverlay.hidden = true;
    spriteOverlay.hidden = true;
    settingsOverlay.hidden = true;
    homeMenu.hidden = kind !== 'menu';
    overlay.classList.toggle('home', kind === 'menu');
    if (kind === 'menu') {
      ovTitle.className = 'title';
      ovTitle.innerHTML = 'Flip<span class="flipped">side</span>';
      ovText.hidden = true;
      ovText.textContent = '';
      if (best > 0) { ovStats.hidden = false; ovStats.innerHTML = '<div class="sub">Best ' + best + '</div>'; }
      ovBtn.textContent = 'Play';
    } else if (kind === 'over') {
      ovTitle.className = 'title sm';
      ovTitle.textContent = deathReason === 'soul' ? 'Out of soul' : 'Crashed';
      stopFuelSiren();
    if (deathReason === 'soul') { ovText.hidden = false; ovText.textContent = 'Grab coins to keep your soul burning.'; }
      else { ovText.hidden = true; }
      const fresh = takeNewAffordable();
      if (fresh.length) { ovText.textContent = (deathReason === 'soul' ? ovText.textContent + ' ' : '') + affordText(fresh); ovText.hidden = false; }
      ovMaps.hidden = false;
      ovStats.hidden = false;
      ovStats.innerHTML = '<div class="score">' + finalScore + '</div><div class="sub">' + (isNewBest ? 'New best' : 'Best ' + best) + '</div>';
      ovBtn.textContent = 'Play again';
      ovBtn.focus({ preventScroll: true });
    } else if (kind === 'paused') {
      ovTitle.className = 'title sm';
      ovTitle.textContent = 'Paused';
      ovText.textContent = 'Your run is on hold.';
      ovBtn.textContent = 'Resume';
      ovSound.hidden = false;
      ovSound.textContent = soundOn ? 'Sound on' : 'Sound off';
      ovBtn.focus({ preventScroll: true });
    }
  }

  function toMenu() {
    bankRun();
    state = 'menu';
    stopMusic();
    resetRun();
    setUi();
    showOverlay('menu');
  }

  function startRun() {
    audio();
    resetRun();
    state = 'playing';
    overlay.hidden = true;
    mapOverlay.hidden = true;
    spriteOverlay.hidden = true;
    settingsOverlay.hidden = true;
    setUi();
    startMusic();
  }

  function pause() {
    if (state !== 'playing') return;
    bankRun();
    state = 'paused';
    pauseMusic();
    stopFuelSiren();
    setUi();
    showOverlay('paused');
  }

  function resume() {
    if (state !== 'paused') return;
    state = 'playing';
    overlay.hidden = true;
    setUi();
    startMusic();
    if (soul < 25 && lowWarned) startFuelSiren();
  }
  function primary() {
    if (splashActive) return;
    if (state === 'menu') playFromHome();
    else if (state === 'maps') playPicked();
    else if (state === 'over') { if (overlayReady) ytRequestInterstitialThenStart(); }
    else if (state === 'paused') resume();
  }

  // ---------- input ----------
  stage.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (overlay.contains(e.target)) return;
    if (state === 'playing') { e.preventDefault(); flip(); }
  });

  window.addEventListener('keydown', (e) => {
    if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
    const c = e.code;
    if (splashActive) { if (c === 'Space' || c === 'Enter' || c === 'Escape') { e.preventDefault(); skipSplash(); } return; }
    const flipKey = c === 'Space' || c === 'ArrowUp' || c === 'ArrowDown' || c === 'KeyW' || c === 'KeyS';
    if (state === 'playing') {
      if (flipKey) { e.preventDefault(); flip(); }
      else if (c === 'KeyB') tryBoost();
      else if (c === 'KeyP' || c === 'Escape') pause();
      return;
    }
    if (state === 'paused' && (c === 'KeyP' || c === 'Escape')) { resume(); return; }
    if (state === 'maps' && c === 'Escape') { backFromMaps(); return; }
    if ((state === 'sprites' || state === 'settings') && c === 'Escape') { backToHome(); return; }
    if ((c === 'Space' || c === 'Enter') && !(e.target instanceof HTMLButtonElement)) {
      e.preventDefault();
      primary();
    }
  });
  window.addEventListener('keyup', (e) => { if (e.code === 'Space' && state === 'playing') e.preventDefault(); });

  ovBtn.addEventListener('click', primary);
  pauseBtn.addEventListener('click', () => { pause(); });
  boostBtn.addEventListener('click', () => { tryBoost(); boostBtn.blur(); });
  ovSound.addEventListener('click', toggleSound);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { pause(); pauseMusic(); }
  });

  function onResize() {
    const changed = layout();
    if (changed) { if (inMenus()) resetRun(); else toMenu(); }
  }
  window.addEventListener('resize', onResize);

  // ---------- splash screen ----------
  // The logo dissolves in, holds, then dissolves out into the home page: 2 seconds in total.
  // A tap or Space/Enter skips it. Nothing behind it can be used while it is showing.
  const SPLASH_IN_MS = 600, SPLASH_HOLD_MS = 800, SPLASH_OUT_MS = 600;
  const SPLASH_TAP_TO_SKIP = true;
  const splash = $('splash'), splashImg = $('splashImg');
  let splashActive = !!splash, splashAnims = [], splashTimer = 0, splashSkipping = false;

  function endSplash() {
    if (!splashActive) return;
    splashActive = false;
    clearTimeout(splashTimer);
    for (const a of splashAnims) { try { a.cancel(); } catch (e) { /* ignore */ } }
    splashAnims = [];
    if (splash && splash.parentNode) splash.parentNode.removeChild(splash);
    stage.inert = false;
  }

  function skipSplash() {
    if (!splashActive || splashSkipping || !SPLASH_TAP_TO_SKIP) return;
    if (!splash.animate || !splashAnims.length) { endSplash(); return; }
    splashSkipping = true;
    const imgOp = parseFloat(getComputedStyle(splashImg).opacity) || 0;
    const boxOp = parseFloat(getComputedStyle(splash).opacity);
    for (const a of splashAnims) { try { a.cancel(); } catch (e) { /* ignore */ } }
    splashImg.style.opacity = String(imgOp);                      // keep the logo exactly as bright as it was
    const out = splash.animate([{ opacity: isNaN(boxOp) ? 1 : boxOp }, { opacity: 0 }], { duration: 220, easing: 'ease-in', fill: 'forwards' });
    splashAnims = [out];
    out.onfinish = endSplash;
  }

  function startSplash() {
    if (!splash) { splashActive = false; return; }
    if (!splash.animate) { endSplash(); return; }                 // very old browser: skip the splash rather than get stuck
    stage.inert = true;
    const begin = () => {
      if (!splashActive || splashSkipping) return;
      const fadeIn = splashImg.animate([{ opacity: 0 }, { opacity: 1 }], { duration: SPLASH_IN_MS, easing: 'ease-out', fill: 'forwards' });
      const fadeOut = splash.animate([{ opacity: 1 }, { opacity: 0 }], { delay: SPLASH_IN_MS + SPLASH_HOLD_MS, duration: SPLASH_OUT_MS, easing: 'ease-in', fill: 'both' });
      splashAnims = [fadeIn, fadeOut];
      fadeOut.onfinish = endSplash;
    };
    splashTimer = setTimeout(endSplash, SPLASH_IN_MS + SPLASH_HOLD_MS + SPLASH_OUT_MS + 1500);   // safety net: never get stuck
    if (splashImg.decode) splashImg.decode().then(begin, begin); else begin();
  }
  if (splash) splash.addEventListener('pointerdown', (e) => { e.preventDefault(); skipSplash(); });

  // ---------- loop ----------
  let last = 0;
  let perfAcc = 0, perfN = 0, perfSkip = 30;
  // If a phone averages under about 45 fps while you play, drop the canvas resolution one notch (it only ever goes down).
  // If it is still that slow at the lowest resolution, also skip the decorative dot grid and the motion trail.
  function watchFrameTime(raw) {
    if (state !== 'playing' || document.hidden || raw > 250) { perfAcc = 0; perfN = 0; perfSkip = 30; return; }
    if (perfSkip > 0) { perfSkip--; return; }
    perfAcc += raw; perfN++;
    if (perfN >= 40) {
      const avg = perfAcc / perfN;
      perfAcc = 0; perfN = 0;
      const next = dprFor(qual * 0.85, lastCssW, lastCssH);
      if (avg > 22 && next < curDpr - 0.02) { qual *= 0.85; perfSkip = 30; layout(); }
      else if (avg > 30 && !lite && curDpr <= DPR_MIN + 0.02) { lite = true; perfSkip = 30; }
    }
  }
  function frame(ts) {
    requestAnimationFrame(frame);
    const raw = ts - last;
    if (last && raw < 10) return;           // a 90 or 120 Hz screen: skip the extra frames, the game needs about 60 a second
    if (window.innerWidth !== lastCssW || window.innerHeight !== lastCssH) onResize();
    const dt = Math.min(0.033, raw / 1000 || 0.016);
    last = ts;
    watchFrameTime(raw);
    update(dt);
    render();
    updateBoostUi();

    if (typeof ytgame !== 'undefined') {
      try {
        if (!ytReadyNotified) {
          ytgame.game.firstFrameReady();
          ytReadyNotified = true;
        }
        if (!ytGameReadyNotified && state !== 'paused' && !splashActive) {
          ytgame.game.gameReady();
          ytGameReadyNotified = true;
        }
      } catch (e) { /* no-op outside the Playables runtime */ }
    }
  }

  try { if (document.fonts && document.fonts.load) document.fonts.load('800 22px "Bricolage Grotesque"'); } catch (e) { /* ignore */ }
  layout();
  resetRun();
  setUi();
  showOverlay('menu');
  window.__flipsidePause = () => { pause(); pauseMusic(); };   // lets the Android app pause the run and music when you leave it
  startSplash();
  requestAnimationFrame(frame);
})();
