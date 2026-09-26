'use strict';

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

