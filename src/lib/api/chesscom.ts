import type { LinkedAccount } from '../types';
import { getJson, HttpError } from './http';

const BASE = 'https://api.chess.com/pub/player/';

interface CcProfile {
  username: string;
  name?: string;
  avatar?: string;
  country?: string;
  title?: string;
  url?: string;
}

interface CcStatsBlock {
  last?: { rating: number };
}

interface CcStats {
  chess_bullet?: CcStatsBlock;
  chess_blitz?: CcStatsBlock;
  chess_rapid?: CcStatsBlock;
  chess_daily?: CcStatsBlock;
  tactics?: { highest?: { rating: number } };
}

export interface CcGame {
  url: string;
  pgn?: string;
  time_control: string;
  time_class: string;
  end_time: number;
  rated: boolean;
  rules: string;
  uuid?: string;
  accuracies?: { white: number; black: number };
  white: { username: string; rating: number; result: string };
  black: { username: string; rating: number; result: string };
}

export async function fetchChesscomAccount(username: string): Promise<LinkedAccount> {
  const u = username.trim().toLowerCase();
  let profile: CcProfile;
  try {
    profile = await getJson<CcProfile>(BASE + encodeURIComponent(u));
  } catch (e) {
    if (e instanceof HttpError && e.status === 404) throw new Error(`Aucun joueur « ${username} » sur Chess.com`);
    throw e;
  }
  let stats: CcStats = {};
  try {
    stats = await getJson<CcStats>(BASE + encodeURIComponent(u) + '/stats');
  } catch {
    /* statistiques facultatives */
  }
  const country = profile.country?.split('/').pop();
  return {
    key: `chesscom:${u}`,
    platform: 'chesscom',
    username: profile.username || u,
    displayName: profile.name,
    avatar: profile.avatar,
    country,
    title: profile.title,
    ratings: {
      bullet: stats.chess_bullet?.last?.rating,
      blitz: stats.chess_blitz?.last?.rating,
      rapid: stats.chess_rapid?.last?.rating,
      daily: stats.chess_daily?.last?.rating,
      puzzle: stats.tactics?.highest?.rating,
    },
  };
}

/** Récupère les parties des derniers mois (les archives les plus récentes d'abord). */
export async function fetchChesscomGames(
  username: string,
  opts: { maxGames: number; since?: number; onProgress?: (msg: string) => void },
): Promise<CcGame[]> {
  const u = username.trim().toLowerCase();
  const { archives } = await getJson<{ archives: string[] }>(BASE + encodeURIComponent(u) + '/games/archives');
  const games: CcGame[] = [];
  const recent = [...archives].reverse();
  for (const url of recent) {
    const month = url.split('/').slice(-2).join('/');
    opts.onProgress?.(`Chess.com : récupération des parties ${month}…`);
    const data = await getJson<{ games: CcGame[] }>(url);
    const monthGames = (data.games ?? []).filter((g) => g.pgn && (g.rules === 'chess' || g.rules === 'chess960')).sort((a, b) => b.end_time - a.end_time);
    let reachedOld = false;
    for (const g of monthGames) {
      if (opts.since && g.end_time * 1000 <= opts.since) {
        reachedOld = true;
        continue;
      }
      games.push(g);
    }
    if (games.length >= opts.maxGames || reachedOld) break;
  }
  return games.slice(0, opts.maxGames);
}
