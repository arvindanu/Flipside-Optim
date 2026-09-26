'use strict';

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

