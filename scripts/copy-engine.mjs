// Copie le moteur Stockfish (WASM, version "lite single-thread") dans public/engine
// pour qu'il soit servi en tant que Web Worker dans la WebView Android.
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'node_modules', 'stockfish', 'bin');
const dest = join(root, 'public', 'engine');

if (!existsSync(src)) {
  console.warn('[copy-engine] stockfish package not found, skipping');
  process.exit(0);
}
mkdirSync(dest, { recursive: true });
for (const ext of ['js', 'wasm']) {
  copyFileSync(join(src, `stockfish-19-lite-single.${ext}`), join(dest, `stockfish.${ext}`));
}
console.log('[copy-engine] Stockfish 19 lite (single-thread) copied to public/engine');
