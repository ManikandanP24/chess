# Chess Helper

Chess Helper now has **two editions**:

- **Browser web app** in `web/`: interactive chessboard, Stockfish 19 WASM analysis, top-three candidate moves, colored arrows, evaluation bar, depth control, FEN import/export, undo/reset. This edition can be hosted on Render as a static site.
- **Electron desktop app** in the repository root: always-on-top window, global hide/show shortcut, and desktop installer configuration.

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/ManikandanP24/chess)

## Deploy the web app to Render

The repository includes `render.yaml` for a Render Static Site.

1. Click **Deploy to Render** above, or open [Render New Blueprint](https://dashboard.render.com/blueprints).
2. Connect the GitHub repository `ManikandanP24/chess`.
3. Review the `chess-helper-web` static site service described by `render.yaml`, then create/deploy it.
4. Wait for the build to finish. Render will provide an `onrender.com` URL.
5. Future commits to `main` are configured for automatic redeployment.

Build command: `npm install && npm run build:web`  
Publish directory: `web`

The build script bundles `chess.js` for the browser and copies the matching Stockfish 19.0.1 single-threaded WASM engine files from the installed npm package into `web/vendor/`. The JavaScript worker and matching `.wasm` file are served from the same origin. This lite single-threaded build does not require cross-origin isolation headers. Stockfish's browser package documents the matching JS/WASM filename pair and the single-threaded engine's compatibility with static hosts.

## Test the web build locally

Requirements: Node.js 20+ and npm.

```bash
npm install
npm run build:web
```

Then serve the `web/` directory over HTTP (don't open the HTML directly using `file://`):

```bash
npx serve web
```

Open the local URL printed by the server. Browser Worker and WASM loading require HTTP(S).

## Web app controls

- Click a piece and then a legal destination square.
- **White view / Black view** flips board orientation.
- **Undo** and **Reset** manage the position.
- Paste a FEN and select **Load FEN**; **Copy current FEN** copies the current position.
- Click a candidate move row to emphasize its arrow.
- Use the depth slider to trade analysis speed for search depth.

## Desktop app

```bash
npm start
```

Build platform installers with `npm run dist`. The Electron app remains separate from the browser-hosted edition.

## License

Stockfish.js is GPL-3.0. Review its license and include required notices/source availability when redistributing or hosting binaries, as applicable.
