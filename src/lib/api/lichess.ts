import type { LinkedAccount } from '../types';
import { getJson, getText, HttpError } from './http';

interface LiPerf {
  rating: number;
  games: number;
  prov?: boolean;
}

interface LiUser {
  id: string;
  username: string;
  title?: string;
  perfs?: Partial<Record<'bullet' | 'blitz' | 'rapid' | 'classical' | 'correspondence' | 'puzzle', LiPerf>>;
  profile?: { flag?: string; country?: string; realName?: string; firstName?: string; lastName?: string };
  count?: { all: number };
}

export async function fetchLichessAccount(username: string): Promise<LinkedAccount> {
  const u = username.trim();
  let user: LiUser;
  try {
    user = await getJson<LiUser>('https://lichess.org/api/user/' + encodeURIComponent(u));
  } catch (e) {
    if (e instanceof HttpError && e.status === 404) throw new Error(`Aucun joueur « ${username} » sur Lichess`);
    throw e;
  }
  if (!user?.id) throw new Error(`Aucun joueur « ${username} » sur Lichess`);
  const p = user.perfs ?? {};
  const name = user.profile?.realName || [user.profile?.firstName, user.profile?.lastName].filter(Boolean).join(' ') || undefined;
  return {
    key: `lichess:${user.id}`,
    platform: 'lichess',
    username: user.username,
    displayName: name,
    country: user.profile?.flag || user.profile?.country,
    title: user.title,
    gameCount: user.count?.all,
    ratings: {
      bullet: p.bullet?.games ? p.bullet.rating : undefined,
      blitz: p.blitz?.games ? p.blitz.rating : undefined,
      rapid: p.rapid?.games ? p.rapid.rating : undefined,
      classical: p.classical?.games ? p.classical.rating : undefined,
      daily: p.correspondence?.games ? p.correspondence.rating : undefined,
      puzzle: p.puzzle?.games ? p.puzzle.rating : undefined,
    },
  };
}

/** Parties au format PGN (avec pendules), les plus récentes d'abord. */
export async function fetchLichessGames(username: string, opts: { maxGames: number; since?: number; onProgress?: (msg: string) => void }): Promise<string> {
  const params = new URLSearchParams({
    max: String(opts.maxGames),
    clocks: 'true',
    opening: 'true',
    evals: 'false',
    perfType: 'ultraBullet,bullet,blitz,rapid,classical,correspondence',
  });
  if (opts.since) params.set('since', String(opts.since + 1));
  opts.onProgress?.('Lichess : récupération des parties…');
  return getText(`https://lichess.org/api/games/user/${encodeURIComponent(username.trim())}?${params}`, 'application/x-chess-pgn');
}
