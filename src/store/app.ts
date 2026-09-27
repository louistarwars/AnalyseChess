import { create } from 'zustand';
import { analyzeGame, type AnalysisProgress } from '../lib/analysis';
import * as db from '../lib/db';
import { CancelledError, getAnalysisEngine } from '../lib/engine';
import { syncAccount } from '../lib/importer';
import type { GameAnalysis, LinkedAccount, StoredGame } from '../lib/types';
import { DEPTHS, useSettings } from './settings';

export type Tab = 'home' | 'games' | 'import' | 'stats' | 'settings';
export type Route = { name: 'review'; gameId: string; ply?: number } | { name: 'about' };

interface Toast {
  id: number;
  text: string;
  kind: 'info' | 'success' | 'error';
}

interface AppState {
  loaded: boolean;
  tab: Tab;
  stack: Route[];
  games: StoredGame[];
  accounts: LinkedAccount[];
  toast?: Toast;
  queue: string[];
  current?: { gameId: string; progress?: AnalysisProgress };
  syncing: Record<string, string | undefined>;
  importTab?: 'chesscom' | 'lichess' | 'pgn';
  gamesFilter?: string;

  init: () => Promise<void>;
  setTab: (t: Tab, opts?: { importTab?: AppState['importTab']; gamesFilter?: string }) => void;
  push: (r: Route) => void;
  pop: () => boolean;
  reloadGames: () => Promise<void>;
  reloadAccounts: () => Promise<void>;
  showToast: (text: string, kind?: Toast['kind']) => void;
  enqueueAnalysis: (ids: string[], front?: boolean) => void;
  cancelAnalysis: (id?: string) => void;
  sync: (acc: LinkedAccount, opts?: { maxGames?: number; full?: boolean; silent?: boolean }) => Promise<void>;
  toggleFavorite: (id: string) => Promise<void>;
  removeGame: (id: string) => Promise<void>;
}

const listeners = new Set<(a: GameAnalysis) => void>();
export function onAnalysisDone(cb: (a: GameAnalysis) => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

let abort: AbortController | null = null;
/** Parties demandées explicitement (ouvertes) : analysées à la profondeur choisie. Les autres (lot) en rapide. */
const priority = new Set<string>();
let running = false;
let toastTimer: ReturnType<typeof setTimeout> | undefined;

export const useApp = create<AppState>((set, get) => ({
  loaded: false,
  tab: 'home',
  stack: [],
  games: [],
  accounts: [],
  queue: [],
  syncing: {},

  init: async () => {
    const [games, accounts] = await Promise.all([db.getAllGames(), db.getAccounts()]);
    set({ games, accounts, loaded: true });
    // Synchronisation silencieuse au démarrage (si la dernière date de plus de 30 min)
    for (const acc of accounts) {
      if (!acc.lastSync || Date.now() - acc.lastSync > 30 * 60 * 1000) get().sync(acc, { silent: true });
    }
  },

  setTab: (tab, opts) => set({ tab, stack: [], importTab: opts?.importTab ?? get().importTab, gamesFilter: opts?.gamesFilter }),
  push: (r) => set({ stack: [...get().stack, r] }),
  pop: () => {
    const { stack, tab } = get();
    if (stack.length) {
      set({ stack: stack.slice(0, -1) });
      return true;
    }
    if (tab !== 'home') {
      set({ tab: 'home' });
      return true;
    }
    return false;
  },

  reloadGames: async () => set({ games: await db.getAllGames() }),
  reloadAccounts: async () => set({ accounts: await db.getAccounts() }),

  showToast: (text, kind = 'info') => {
    clearTimeout(toastTimer);
    set({ toast: { id: Date.now(), text, kind } });
    toastTimer = setTimeout(() => set({ toast: undefined }), 3200);
  },

  enqueueAnalysis: (ids, front = false) => {
    if (front) ids.forEach((id) => priority.add(id));
    const { queue, current } = get();
    const todo = ids.filter((id) => id !== current?.gameId);
    let q = queue.filter((x) => !todo.includes(x));
    q = front ? [...todo, ...q] : [...q, ...todo];
    if (front && current && todo.length) {
      // Priorité à la partie ouverte : l'analyse en cours est interrompue puis reprise juste après.
      q = q.filter((x) => x !== current.gameId);
      q.splice(todo.length, 0, current.gameId);
      set({ queue: q });
      abort?.abort();
    } else set({ queue: q });
    runQueue();
  },

  cancelAnalysis: (id) => {
    const { current, queue } = get();
    if (!id) {
      set({ queue: [] });
      abort?.abort();
      return;
    }
    set({ queue: queue.filter((q) => q !== id) });
    if (current?.gameId === id) abort?.abort();
  },

  sync: async (acc, opts = {}) => {
    if (get().syncing[acc.key]) return;
    set({ syncing: { ...get().syncing, [acc.key]: 'Connexion…' } });
    try {
      const res = await syncAccount(acc, {
        maxGames: opts.maxGames,
        full: opts.full,
        onProgress: (msg) => set({ syncing: { ...get().syncing, [acc.key]: msg } }),
      });
      await Promise.all([get().reloadGames(), get().reloadAccounts()]);
      if (!opts.silent || res.added > 0) {
        get().showToast(res.added ? `${res.added} nouvelle${res.added > 1 ? 's' : ''} partie${res.added > 1 ? 's' : ''} importée${res.added > 1 ? 's' : ''}` : 'Parties à jour', 'success');
      }
    } catch (e) {
      if (!opts.silent) get().showToast((e as Error).message || 'Échec de la synchronisation', 'error');
    } finally {
      set({ syncing: { ...get().syncing, [acc.key]: undefined } });
    }
  },

  toggleFavorite: async (id) => {
    const g = get().games.find((x) => x.id === id);
    if (!g) return;
    await db.updateGame(id, { favorite: !g.favorite });
    set({ games: get().games.map((x) => (x.id === id ? { ...x, favorite: !x.favorite } : x)) });
  },

  removeGame: async (id) => {
    await db.deleteGame(id);
    set({ games: get().games.filter((g) => g.id !== id) });
  },
}));

async function runQueue() {
  if (running) return;
  running = true;
  const engine = getAnalysisEngine();
  try {
    while (useApp.getState().queue.length) {
      const [gameId, ...rest] = useApp.getState().queue;
      useApp.setState({ queue: rest, current: { gameId } });
      const game = useApp.getState().games.find((g) => g.id === gameId) ?? (await db.getGame(gameId));
      if (!game) continue;
      abort = new AbortController();
      const chosen = DEPTHS[useSettings.getState().depthPreset].depth;
      const depth = priority.has(gameId) ? chosen : Math.min(chosen, 12);
      let last = 0;
      try {
        const analysis = await analyzeGame(gameId, game.pgn, {
          depth,
          engine,
          signal: abort.signal,
          onProgress: (p) => {
            const now = performance.now();
            if (now - last > 120 || p.done === p.total) {
              last = now;
              useApp.setState({ current: { gameId, progress: p } });
            }
          },
        });
        await db.saveAnalysis(analysis);
        priority.delete(gameId);
        useApp.setState({
          games: useApp.getState().games.map((g) => (g.id === gameId ? { ...g, summary: analysis.summary, opening: analysis.opening?.name ?? g.opening, eco: g.eco ?? analysis.opening?.eco } : g)),
        });
        listeners.forEach((cb) => cb(analysis));
      } catch (e) {
        if (!(e instanceof CancelledError)) {
          console.error(e);
          useApp.getState().showToast("L'analyse a échoué : " + ((e as Error).message || 'erreur inconnue'), 'error');
        }
      }
    }
  } finally {
    running = false;
    abort = null;
    useApp.setState({ current: undefined });
  }
}
