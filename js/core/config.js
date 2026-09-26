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

