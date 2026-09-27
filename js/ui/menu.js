'use strict';

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

