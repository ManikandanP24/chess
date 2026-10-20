# Chess Helper

Chess Helper includes a browser analysis page, a Chrome extension prototype, and the existing Electron desktop app.

- **Chrome extension** in `extension/`: popup controls, Stockfish analysis, best-move arrow overlay on Chess.com, FEN input, depth control, and an auto-move option restricted to recognized bot-game/puzzle URLs.
- **Browser web app** in `web/`: interactive chessboard, Stockfish WASM analysis, top-three candidate moves, arrows, evaluation bar, depth control, and FEN import/export. Hostable on Render.
- **Electron desktop app** in the repository root: always-on-top window and desktop installer configuration.

## Build

Requirements: Node.js 20+ and npm.

```bash
npm install
npm run build:web
npm run build:extension
```

The extension build creates the matching Stockfish 19.0.1 JavaScript/WASM assets under `extension/vendor/` and bundles the popup script.

## Load the Chrome extension locally

1. Run `npm install` and `npm run build:extension`.
2. Open `chrome://extensions` in Chrome.
3. Enable **Developer mode**.
4. Choose **Load unpacked** and select this repository's `extension/` folder.
5. Open a Chess.com game or puzzle and click the Chess Helper extension icon.

The extension attempts to read the board's piece classes to build a FEN. If board detection is unavailable, paste a FEN position into the popup. Board markup can change over time, so test it against the current Chess.com interface. Best-move analysis is intended for study and practice; auto-move is limited to recognized bot-game and puzzle URLs and should not be used in live games against people.

## Deploy the browser analysis page to Render

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/ManikandanP24/chess)

The repository includes `render.yaml` for the `chess-helper-web` static site.

1. Click **Deploy to Render** above or open [Render Blueprints](https://dashboard.render.com/blueprints).
2. Connect `ManikandanP24/chess`, review the static-site service, and create/deploy it.
3. Wait for the build and use the public `.onrender.com` URL.

Build command: `npm install && npm run build:web`  
Publish directory: `web`

## Desktop app

```bash
npm start
npm run dist
```

## License

Stockfish.js is GPL-3.0. Review the license and include required notices/source availability when redistributing or hosting binaries, as applicable.
