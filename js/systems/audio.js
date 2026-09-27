'use strict';

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
      const src = new URL('assets/audio/music.mp3', window.location.href).href;
      music = new Audio(src);
      music.loop = true;
      music.preload = 'auto';
      music.autoplay = false;
      music.volume = MUSIC_VOLUME;
      music.muted = false;
      music.setAttribute('playsinline', '');
      music.addEventListener('error', () => {
        console.warn('Flipside: assets/audio/music.mp3 could not be loaded:', music.error);
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

