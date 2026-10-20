const fs = require('node:fs');
const path = require('node:path');
const { build } = require('esbuild');

const root = path.resolve(__dirname, '..');
const stockfishBin = path.join(root, 'node_modules', 'stockfish', 'bin');
const assets = ['stockfish-19-lite-single.js', 'stockfish-19-lite-single.wasm'];

async function main() {
  const vendorDir = path.join(root, 'web', 'vendor');
  fs.mkdirSync(vendorDir, { recursive: true });
  for (const asset of assets) {
    const source = path.join(stockfishBin, asset);
    if (!fs.existsSync(source)) throw new Error(`Missing Stockfish browser asset: ${source}`);
    fs.copyFileSync(source, path.join(vendorDir, asset));
  }
  await build({
    entryPoints: [path.join(root, 'web', 'app-src.js')],
    outfile: path.join(root, 'web', 'app.js'),
    bundle: true, platform: 'browser', format: 'iife', target: ['es2020'], minify: true
  });
  const extensionDir = path.join(root, 'extension');
  const extensionVendor = path.join(extensionDir, 'vendor');
  fs.mkdirSync(extensionVendor, { recursive: true });
  for (const asset of assets) fs.copyFileSync(path.join(stockfishBin, asset), path.join(extensionVendor, asset));
  await build({
    entryPoints: [path.join(extensionDir, 'popup-src.js')],
    outfile: path.join(extensionDir, 'popup.js'),
    bundle: true, platform: 'browser', format: 'iife', target: ['es2020'], minify: true
  });
  for (const file of ['manifest.json', 'popup.html', 'popup.css', 'popup.js', 'content.js', 'vendor/stockfish-19-lite-single.js', 'vendor/stockfish-19-lite-single.wasm']) {
    if (!fs.existsSync(path.join(extensionDir, file))) throw new Error(`Missing extension output: ${file}`);
  }
  console.log('Built web app and Chrome extension; Stockfish JS/WASM assets verified.');
}
main().catch(error => { console.error(error); process.exit(1); });
