const fs = require('node:fs');
const path = require('node:path');
const { build } = require('esbuild');

const root = path.resolve(__dirname, '..');
const stockfishBin = path.join(root, 'node_modules', 'stockfish', 'bin');
const vendorDir = path.join(root, 'web', 'vendor');
const assets = ['stockfish-19-lite-single.js', 'stockfish-19-lite-single.wasm'];

async function main() {
  fs.mkdirSync(vendorDir, { recursive: true });
  for (const asset of assets) {
    const source = path.join(stockfishBin, asset);
    if (!fs.existsSync(source)) {
      throw new Error(`Missing Stockfish 19.0.1 browser asset: ${source}`);
    }
    fs.copyFileSync(source, path.join(vendorDir, asset));
    console.log(`Copied ${asset}`);
  }
  await build({
    entryPoints: [path.join(root, 'web', 'app-src.js')],
    outfile: path.join(root, 'web', 'app.js'),
    bundle: true,
    platform: 'browser',
    format: 'iife',
    target: ['es2020'],
    minify: true,
    sourcemap: false
  });
  console.log('Built web/app.js');
}
main().catch(error => { console.error(error); process.exit(1); });
