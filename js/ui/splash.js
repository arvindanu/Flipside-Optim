'use strict';

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

