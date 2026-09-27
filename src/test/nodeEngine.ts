import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { join } from 'node:path';
import { Engine, type WorkerLike } from '../lib/engine';

/** Stockfish (WASM) exécuté par Node dans un processus fils — pour les tests. */
export function createNodeEngine(): Engine {
  return new Engine(() => {
    const proc = spawn(process.execPath, [join(process.cwd(), 'node_modules/stockfish/bin/stockfish-19-lite-single.js')], { stdio: 'pipe' });
    const w: WorkerLike = {
      onmessage: null,
      onerror: null,
      postMessage: (msg: string) => proc.stdin.write(msg + '\n'),
      terminate: () => proc.kill(),
    };
    createInterface({ input: proc.stdout }).on('line', (line) => w.onmessage?.({ data: line }));
    return w;
  });
}
