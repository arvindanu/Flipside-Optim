# Flipside — Rebuilt Split Project

This project is a structural split of the supplied Flipside HTML game. The game logic, HTML UI, CSS styling, rendering code, maps, sprites, physics, input handling, storage, audio logic, YouTube Playables integration, and gameplay behavior were kept in the existing source code rather than rewritten.

## Structure

- `index.html` — game markup and UI structure
- `css/styles.css` — the original inline CSS moved out of `index.html`
- `js/game.js` — the original inline game JavaScript moved out of `index.html`
- `assets/splash.jpg` — the original embedded splash artwork extracted byte-for-byte from the data URI

## Notes

- The source version used for this rebuild is the saved no-lighthouse-beam version, so the Lighthouse rotating beam/preview beam is not reintroduced.
- The original code references `music.mp3`. No `music.mp3` file was present alongside the supplied source files, so that reference has intentionally not been changed or replaced. Add the original `music.mp3` beside `index.html` if you have it.
- The YouTube Playables script URL remains unchanged.

## Run

Serve the folder through a normal web server (for example, Vercel or another static host). Opening `index.html` directly may restrict some browser features, so a local HTTP server is preferred for testing.
