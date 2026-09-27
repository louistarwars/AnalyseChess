import { cyrb53 } from './pgn';

interface OpeningDb {
  names: [string, string][];
  book: Record<string, number>;
}

let db: OpeningDb | null = null;
let loading: Promise<OpeningDb> | null = null;

export function loadOpenings(): Promise<OpeningDb> {
  if (db) return Promise.resolve(db);
  if (!loading) {
    loading = import('../data/openings.json').then((m) => {
      db = (m.default ?? m) as unknown as OpeningDb;
      return db;
    });
  }
  return loading;
}

export const positionKey = (fen: string) => cyrb53(fen.split(' ').slice(0, 4).join(' '));

export interface BookInfo {
  inBook: boolean;
  opening?: { eco: string; name: string };
}

export function lookupSync(fen: string): BookInfo {
  if (!db) return { inBook: false };
  const idx = db.book[positionKey(fen)];
  if (idx === undefined) return { inBook: false };
  if (idx < 0) return { inBook: true };
  const [eco, name] = db.names[idx];
  return { inBook: true, opening: { eco, name } };
}

/** Parcourt les positions d'une partie : dernier nom d'ouverture rencontré + nombre de demi-coups théoriques. */
export function identifyOpening(fens: string[]): { opening?: { eco: string; name: string }; bookPlies: number } {
  let opening: { eco: string; name: string } | undefined;
  let bookPlies = 0;
  for (let i = 1; i < fens.length; i++) {
    const info = lookupSync(fens[i]);
    if (!info.inBook) break;
    bookPlies = i;
    if (info.opening) opening = info.opening;
  }
  return { opening, bookPlies };
}
