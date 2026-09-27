'use strict';

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

