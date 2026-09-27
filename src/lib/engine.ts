import { fromUci } from './evaluation';
import type { Color, EngineLine, PositionEval } from './types';

export interface AnalyzeOptions {
  depth?: number;
  movetime?: number;
  multiPv?: number;
  infinite?: boolean;
  onUpdate?: (ev: PositionEval) => void;
}

interface Job {
  fen: string;
  opts: AnalyzeOptions;
  resolve: (ev: PositionEval) => void;
  reject: (e: Error) => void;
  lines: EngineLine[];
  depth: number;
  cancelled: boolean;
  started: boolean;
}

export interface WorkerLike {
  postMessage(msg: string): void;
  onmessage: ((e: { data: unknown }) => void) | null;
  onerror: ((e: { message?: string }) => void) | null;
  terminate(): void;
}

const defaultWorker = (): WorkerLike => new Worker(new URL('engine/stockfish.js', document.baseURI).toString()) as unknown as WorkerLike;

export class CancelledError extends Error {
  constructor() {
    super('cancelled');
  }
}

/**
 * Enveloppe UCI autour de Stockfish (WASM) exécuté dans un Web Worker.
 * Les requêtes sont sérialisées : une seule recherche à la fois.
 */
export class Engine {
  private worker: WorkerLike | null = null;
  private readyPromise: Promise<void> | null = null;
  private queue: Job[] = [];
  private current: Job | null = null;
  private multiPv = 1;
  private waiters: { match: (l: string) => boolean; resolve: () => void }[] = [];
  public name = 'Stockfish';

  constructor(private factory: () => WorkerLike = defaultWorker) {}

  init(): Promise<void> {
    if (this.readyPromise) return this.readyPromise;
    this.readyPromise = new Promise<void>((resolve, reject) => {
      try {
        this.worker = this.factory();
      } catch (e) {
        reject(e as Error);
        return;
      }
      this.worker.onmessage = (e) => this.onLine(String(e.data));
      this.worker.onerror = (e) => reject(new Error('Impossible de démarrer le moteur : ' + (e.message || 'erreur inconnue')));
      const timeout = setTimeout(() => reject(new Error('Le moteur ne répond pas')), 30000);
      this.waitFor((l) => l === 'uciok')
        .then(() => {
          this.send('setoption name Hash value 32');
          this.send('setoption name UCI_ShowWDL value false');
          return this.isReady();
        })
        .then(() => {
          clearTimeout(timeout);
          resolve();
        });
      this.send('uci');
    });
    return this.readyPromise;
  }

  private send(cmd: string) {
    this.worker?.postMessage(cmd);
  }

  private waitFor(match: (l: string) => boolean): Promise<void> {
    return new Promise((resolve) => this.waiters.push({ match, resolve }));
  }

  private isReady(): Promise<void> {
    const p = this.waitFor((l) => l === 'readyok');
    this.send('isready');
    return p;
  }

  private onLine(line: string) {
    for (const raw of line.split('\n')) {
      const l = raw.trim();
      if (!l) continue;
      if (l.startsWith('id name ')) this.name = l.slice(8);
      const idx = this.waiters.findIndex((w) => w.match(l));
      if (idx >= 0) {
        const [w] = this.waiters.splice(idx, 1);
        w.resolve();
      }
      const job = this.current;
      if (!job) continue;
      if (l.startsWith('info ') && l.includes(' pv ')) this.parseInfo(job, l);
      else if (l.startsWith('bestmove')) this.finish(job, l);
    }
  }

  private parseInfo(job: Job, l: string) {
    const t = l.split(' ');
    let depth = 0;
    let multipv = 1;
    let kind: 'cp' | 'mate' | null = null;
    let value = 0;
    let bound = false;
    let pv: string[] = [];
    for (let i = 1; i < t.length; i++) {
      switch (t[i]) {
        case 'depth':
          depth = Number(t[++i]);
          break;
        case 'multipv':
          multipv = Number(t[++i]);
          break;
        case 'score':
          kind = t[++i] as 'cp' | 'mate';
          value = Number(t[++i]);
          if (t[i + 1] === 'lowerbound' || t[i + 1] === 'upperbound') {
            bound = true;
            i++;
          }
          break;
        case 'pv':
          pv = t.slice(i + 1);
          i = t.length;
          break;
      }
    }
    if (!kind || !pv.length || bound) return;
    const turn = job.fen.split(' ')[1] as Color;
    job.lines[multipv - 1] = { move: pv[0], pv, depth, score: fromUci(kind, value, turn) };
    if (multipv === 1) job.depth = depth;
    if (job.opts.onUpdate && multipv === Math.min(job.opts.multiPv ?? 1, job.lines.length)) {
      job.opts.onUpdate(this.snapshot(job));
    }
  }

  private snapshot(job: Job): PositionEval {
    return { fen: job.fen, depth: job.depth, lines: job.lines.filter(Boolean).map((x) => ({ ...x })) };
  }

  private finish(job: Job, l: string) {
    this.current = null;
    if (job.cancelled) job.reject(new CancelledError());
    else {
      const best = l.split(' ')[1];
      const ev = this.snapshot(job);
      if (!ev.lines.length && best && best !== '(none)') {
        ev.lines.push({ move: best, pv: [best], depth: 0, score: { cp: 0 } });
      }
      job.resolve(ev);
    }
    this.next();
  }

  private next() {
    if (this.current) return;
    const job = this.queue.shift();
    if (!job) return;
    this.current = job;
    job.started = true;
    const mpv = job.opts.multiPv ?? 1;
    if (mpv !== this.multiPv) {
      this.send(`setoption name MultiPV value ${mpv}`);
      this.multiPv = mpv;
    }
    this.send(`position fen ${job.fen}`);
    if (job.opts.infinite) this.send('go infinite');
    else {
      const parts = ['go'];
      if (job.opts.depth) parts.push('depth', String(job.opts.depth));
      if (job.opts.movetime) parts.push('movetime', String(job.opts.movetime));
      if (parts.length === 1) parts.push('depth', '14');
      this.send(parts.join(' '));
    }
  }

  analyze(fen: string, opts: AnalyzeOptions = {}): { promise: Promise<PositionEval>; cancel: () => void; stop: () => void } {
    let job!: Job;
    const promise = new Promise<PositionEval>((resolve, reject) => {
      job = { fen, opts, resolve, reject, lines: [], depth: 0, cancelled: false, started: false };
    });
    this.init().then(() => {
      if (job.cancelled) return;
      this.queue.push(job);
      this.next();
    }, job.reject);
    const cancel = () => {
      if (job.cancelled) return;
      job.cancelled = true;
      if (this.current === job) this.send('stop');
      else {
        const i = this.queue.indexOf(job);
        if (i >= 0) this.queue.splice(i, 1);
        job.reject(new CancelledError());
      }
    };
    // stop() termine la recherche en gardant le résultat courant
    const stop = () => {
      if (this.current === job) this.send('stop');
    };
    return { promise, cancel, stop };
  }

  newGame() {
    this.init().then(() => {
      if (!this.current) this.send('ucinewgame');
    });
  }

  destroy() {
    this.worker?.terminate();
    this.worker = null;
    this.readyPromise = null;
    for (const j of this.queue) j.reject(new CancelledError());
    this.current?.reject(new CancelledError());
    this.queue = [];
    this.current = null;
  }
}

let shared: Engine | null = null;
let live: Engine | null = null;

/** Moteur dédié aux analyses de parties (file d'attente). */
export function getAnalysisEngine(): Engine {
  if (!shared) shared = new Engine();
  return shared;
}

/** Moteur dédié à l'exploration interactive (analyse en continu). */
export function getLiveEngine(): Engine {
  if (!live) live = new Engine();
  return live;
}
