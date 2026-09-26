'use strict';

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

