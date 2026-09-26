# Flipside

This is the same game as before, split out of the original single `index.html`
into a regular multi-file project. No gameplay, visuals, or behavior changed —
see "What changed" below for the only two real edits.

## Structure

```
index.html              Page shell: markup + <link>/<script> tags only
css/
  style.css             All styles (was the inline <style> block)
assets/
  images/splash.jpg      The splash screen art (was a base64 data: URI)
  audio/                 Put your music.mp3 here (see audio/README.txt)
js/
  core/                  Engine plumbing
    config.js              DOM refs, theme/font constants, tuning numbers, small utils, local-storage guard
    wallet.js                points, unlocks, save/load
    layout.js                  canvas sizing / DPR / resolution scaling
    state.js                    shared mutable game state (player, run, arrays)
    main.js                      perf-adaptive frame loop + startup (loaded last)
  io/
    playables.js           YouTube Playables SDK integration
  maps/                   Everything about map content and how it's drawn
    maps-data.js            prices, theme colors, the MAPS array
    obstacle-shapes.js       obstacle silhouettes + collision profiles
    obstacle-paint.js        obstacle rendering
    thumbnails.js            map-card preview canvases
    backgrounds.js           per-map background/particle effects (skyline, snow, mist, stars, ...)
  systems/                Core gameplay systems
    audio.js                 Web Audio setup, music, sound effects
    particles.js              particle pool
    entities.js                coins/soul + boost rocket
    physics.js                  the main update loop (flip, spawn, collide)
    render-core.js               sprite caching + shared draw helpers
    render.js                     the render() pipeline (backdrop, obstacles, HUD, player)
  ui/                     Screens and input
    map-shop.js              buy/select-a-map screen
    sprites.js                cosmetic skins + sprite shop screen
    menu.js                    settings toggles + home menu/screen flow
    ui.js                       overlay/timer/state-transition helpers
    input.js                    pointer/keyboard handling
    splash.js                   splash screen

23 script files, loaded with `defer` in dependency order from `index.html`.
```

## Why plain scripts instead of ES modules

Everything is loaded as classic `<script defer src="...">` tags sharing one
top-level scope (the same way the original code's variables and functions
already related to each other — nothing was renamed or re-scoped). ES
modules (`type="module"`) were deliberately **not** used because they refuse
to load over `file://`, which would break opening the game directly and any
Android WebView build that loads local files that way. `defer` keeps the
files downloading in parallel while preserving the exact execution order the
code relies on, so this also loads faster than the old single 225 KB inline
script.

## Running it

Any static file server works, e.g. from this folder:

```
python3 -m http.server 8000
```

then open `http://localhost:8000/`. Opening `index.html` directly
(`file://`) should also work, since nothing here uses ES modules — but a
real Google Fonts / YouTube Playables SDK connection needs actual internet
access either way.

## What changed

Only two things are different from the file you uploaded, both purely
mechanical:

1. **The splash image** was a ~32 KB inline base64 `data:` URI; it's now a
   real file at `assets/images/splash.jpg`, referenced by a normal `src`.
2. **The music path** changed from `music.mp3` to `assets/audio/music.mp3`
   in `js/systems/audio.js`, to match the new `assets/` folder. Drop your
   `music.mp3` there.

Everything else — every function, variable, constant, and line of game
logic — was moved into these files unchanged. This was checked by
reconstructing the original script from the 23 split files and diffing it
byte-for-byte against the source (identical), and by loading both versions
in a real headless browser and comparing screenshots and console output at
the splash screen, home menu, live gameplay, and the map shop (pixel-
identical on the deterministic screens; zero console errors in either).
