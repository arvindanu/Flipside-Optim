'use strict';

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

