import { fetchChesscomAccount, fetchChesscomGames, type CcGame } from './api/chesscom';
import { fetchLichessAccount, fetchLichessGames } from './api/lichess';
import { putAccount, putGames } from './db';
import { identifyOpening, loadOpenings } from './openings';
import { gameTimestamp, parseGame, parseMany, pgnGameId, timeClassFromControl, type ParsedGame } from './pgn';
import type { Color, GameResult, LinkedAccount, StoredGame, TimeClass } from './types';

function num(v?: string): number | undefined {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function userColorFor(parsed: ParsedGame, usernames: string[]): Color | undefined {
  const w = (parsed.headers.White || '').toLowerCase();
  const b = (parsed.headers.Black || '').toLowerCase();
  for (const u of usernames.map((x) => x.toLowerCase())) {
    if (w === u) return 'w';
    if (b === u) return 'b';
  }
  return undefined;
}

function toStored(pgn: string, parsed: ParsedGame, extra: Partial<StoredGame> & { id: string; source: StoredGame['source'] }): StoredGame {
  const h = parsed.headers;
  const book = identifyOpening(parsed.fens).opening;
  return {
    pgn,
    white: h.White || 'Blancs',
    black: h.Black || 'Noirs',
    whiteElo: num(h.WhiteElo),
    blackElo: num(h.BlackElo),
    result: parsed.result,
    timestamp: gameTimestamp(h) || Date.now(),
    timeControl: h.TimeControl,
    timeClass: timeClassFromControl(h.TimeControl),
    eco: book?.eco ?? h.ECO,
    opening: book?.name ?? h.Opening,
    termination: h.Termination,
    url: h.Link || (h.Site?.startsWith('http') ? h.Site : undefined),
    plies: parsed.moves.length,
    importedAt: Date.now(),
    ...extra,
  };
}

/** Nécessite que la base d'ouvertures soit chargée (voir importPgnText). */
export function gamesFromPgnText(text: string, linkedUsernames: string[]): { games: StoredGame[]; errors: string[] } {
  const { games, errors } = parseMany(text);
  return {
    games: games.map(({ pgn, parsed }) => {
      const site = parsed.headers.Site || '';
      const li = site.match(/lichess\.org\/(\w{8})/);
      const id = li ? `lichess:${li[1]}` : pgnGameId(parsed);
      return toStored(pgn, parsed, {
        id,
        source: li ? 'lichess' : 'pgn',
        userColor: userColorFor(parsed, linkedUsernames),
      });
    }),
    errors,
  };
}

function chesscomGameToStored(g: CcGame, account: LinkedAccount): StoredGame | null {
  if (!g.pgn) return null;
  let parsed: ParsedGame;
  try {
    parsed = parseGame(g.pgn);
  } catch {
    return null;
  }
  if (!parsed.moves.length) return null;
  const id = `chesscom:${g.url.split('/').pop() ?? g.uuid}`;
  const tc: TimeClass = (['bullet', 'blitz', 'rapid', 'daily'] as TimeClass[]).includes(g.time_class as TimeClass) ? (g.time_class as TimeClass) : timeClassFromControl(g.time_control);
  const stored = toStored(g.pgn, parsed, {
    id,
    source: 'chesscom',
    url: g.url,
    timeClass: tc,
    timestamp: g.end_time * 1000,
    whiteElo: g.white.rating,
    blackElo: g.black.rating,
    accountKey: account.key,
    userColor: g.white.username.toLowerCase() === account.username.toLowerCase() ? 'w' : g.black.username.toLowerCase() === account.username.toLowerCase() ? 'b' : undefined,
  });
  // Chess.com : à défaut de nom trouvé dans notre base, on reprend celui de l'URL ECOUrl
  const ecoUrl = parsed.headers.ECOUrl;
  if (!stored.opening && ecoUrl) stored.opening = decodeURIComponent(ecoUrl.split('/').pop() ?? '').replace(/-/g, ' ');
  return stored;
}

export async function importPgnText(text: string, linkedUsernames: string[]): Promise<{ games: StoredGame[]; added: number; errors: string[] }> {
  await loadOpenings();
  const { games, errors } = gamesFromPgnText(text, linkedUsernames);
  const added = games.length ? await putGames(games) : 0;
  return { games, added, errors };
}

export async function linkAccount(platform: 'chesscom' | 'lichess', username: string): Promise<LinkedAccount> {
  const acc = platform === 'chesscom' ? await fetchChesscomAccount(username) : await fetchLichessAccount(username);
  await putAccount(acc);
  return acc;
}

export async function syncAccount(
  account: LinkedAccount,
  opts: { maxGames?: number; full?: boolean; onProgress?: (msg: string) => void } = {},
): Promise<{ account: LinkedAccount; added: number; total: number }> {
  const maxGames = opts.maxGames ?? 100;
  const since = opts.full ? undefined : account.lastSync ? account.lastSync - 3600_000 : undefined;
  let fresh: LinkedAccount = account;
  try {
    fresh = account.platform === 'chesscom' ? await fetchChesscomAccount(account.username) : await fetchLichessAccount(account.username);
    fresh = { ...account, ...fresh, lastSync: account.lastSync };
  } catch {
    /* profil indisponible : on garde l'ancien */
  }
  await loadOpenings();
  let games: StoredGame[] = [];
  if (account.platform === 'chesscom') {
    const cc = await fetchChesscomGames(account.username, { maxGames, since, onProgress: opts.onProgress });
    games = cc.map((g) => chesscomGameToStored(g, account)).filter((g): g is StoredGame => !!g);
  } else {
    const text = await fetchLichessGames(account.username, { maxGames, since, onProgress: opts.onProgress });
    games = gamesFromPgnText(text, [account.username]).games.map((g) => ({ ...g, accountKey: account.key, source: 'lichess' as const }));
  }
  opts.onProgress?.(`Enregistrement de ${games.length} parties…`);
  const added = await putGames(games);
  const updated: LinkedAccount = { ...fresh, lastSync: Date.now() };
  await putAccount(updated);
  return { account: updated, added, total: games.length };
}

export function resultForColor(result: GameResult, color: Color): 'win' | 'loss' | 'draw' | 'unknown' {
  if (result === '1/2-1/2') return 'draw';
  if (result === '*') return 'unknown';
  return (result === '1-0') === (color === 'w') ? 'win' : 'loss';
}
