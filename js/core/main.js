'use strict';

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
