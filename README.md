# Chess Helper

Always-on-top Electron desktop chess analysis app with an interactive board, Stockfish WASM engine, top-three candidate moves, move arrows, evaluation, depth control, FEN import/export, undo/reset, and global hide/show shortcut.

## Run locally

Requirements: Node.js 20+ and npm.

```bash
npm install
npm start
```

Stockfish 19.0.1's Node API is used in the Electron main process and resolves the matching engine/WASM assets from the package. This avoids manually copying mismatched WASM files and avoids a browser Worker attempting to load WASM through a `file://` URL. The `lite-single` variant is single-threaded and does not depend on cross-origin isolation.

## Controls

- Click a piece and a legal destination square.
- White/Black flips board orientation.
- Undo and Reset manage the position.
- Paste a FEN and press **Load FEN**; **Copy current FEN** copies the current position.
- Candidate move rows prioritize their arrow.
- Ctrl+Shift+H hides or restores the window.

## Desktop releases

This is a desktop app, not a static website. A GitHub Actions workflow builds Windows NSIS `.exe`, macOS `.dmg`, and Linux `.AppImage` artifacts. Push a tag such as `v1.0.0` to create a GitHub Release draft with attached installers. Review and publish the release from GitHub Releases.

## License note

Stockfish is GPL-3.0. Review the Stockfish and dependency license terms, include required notices/source offers where applicable, and verify obligations before redistributing binaries.
