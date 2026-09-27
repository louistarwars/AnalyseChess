import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { GameAnalysis, LinkedAccount, StoredGame } from './types';

interface ChessDB extends DBSchema {
  games: {
    key: string;
    value: StoredGame;
    indexes: { byTimestamp: number; byAccount: string };
  };
  analyses: {
    key: string;
    value: GameAnalysis;
  };
  accounts: {
    key: string;
    value: LinkedAccount;
  };
}

let dbPromise: Promise<IDBPDatabase<ChessDB>> | null = null;

function db() {
  if (!dbPromise) {
    dbPromise = openDB<ChessDB>('analysechess', 1, {
      upgrade(d) {
        const games = d.createObjectStore('games', { keyPath: 'id' });
        games.createIndex('byTimestamp', 'timestamp');
        games.createIndex('byAccount', 'accountKey');
        d.createObjectStore('analyses', { keyPath: 'gameId' });
        d.createObjectStore('accounts', { keyPath: 'key' });
      },
    });
  }
  return dbPromise;
}

export async function getAllGames(): Promise<StoredGame[]> {
  const all = await (await db()).getAllFromIndex('games', 'byTimestamp');
  return all.reverse();
}

export async function getGame(id: string) {
  return (await db()).get('games', id);
}

/** Ajoute des parties ; les parties déjà présentes conservent leur analyse et leurs favoris. */
export async function putGames(games: StoredGame[]): Promise<number> {
  const d = await db();
  const tx = d.transaction('games', 'readwrite');
  let added = 0;
  for (const g of games) {
    const existing = await tx.store.get(g.id);
    if (existing) {
      await tx.store.put({ ...g, summary: existing.summary, favorite: existing.favorite, importedAt: existing.importedAt, userColor: g.userColor ?? existing.userColor, accountKey: g.accountKey ?? existing.accountKey });
    } else {
      added++;
      await tx.store.put(g);
    }
  }
  await tx.done;
  return added;
}

export async function updateGame(id: string, patch: Partial<StoredGame>) {
  const d = await db();
  const g = await d.get('games', id);
  if (!g) return;
  await d.put('games', { ...g, ...patch });
}

export async function deleteGame(id: string) {
  const d = await db();
  await d.delete('games', id);
  await d.delete('analyses', id);
}

export async function getAnalysis(gameId: string) {
  return (await db()).get('analyses', gameId);
}

export async function saveAnalysis(a: GameAnalysis) {
  const d = await db();
  await d.put('analyses', a);
  const g = await d.get('games', a.gameId);
  if (g) await d.put('games', { ...g, summary: a.summary, eco: g.eco ?? a.opening?.eco, opening: a.opening?.name ?? g.opening });
}

export async function getAccounts(): Promise<LinkedAccount[]> {
  return (await db()).getAll('accounts');
}

export async function putAccount(a: LinkedAccount) {
  await (await db()).put('accounts', a);
}

export async function deleteAccount(key: string, withGames: boolean) {
  const d = await db();
  await d.delete('accounts', key);
  if (withGames) {
    const ids = await d.getAllKeysFromIndex('games', 'byAccount', key);
    const tx = d.transaction(['games', 'analyses'], 'readwrite');
    for (const id of ids) {
      await tx.objectStore('games').delete(id);
      await tx.objectStore('analyses').delete(id);
    }
    await tx.done;
  }
}

export async function clearAll() {
  const d = await db();
  const tx = d.transaction(['games', 'analyses', 'accounts'], 'readwrite');
  await Promise.all([tx.objectStore('games').clear(), tx.objectStore('analyses').clear(), tx.objectStore('accounts').clear()]);
  await tx.done;
}
