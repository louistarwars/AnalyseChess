export type Color = 'w' | 'b';
export type PieceType = 'p' | 'n' | 'b' | 'r' | 'q' | 'k';

export type Classification =
  | 'brilliant'
  | 'great'
  | 'best'
  | 'excellent'
  | 'good'
  | 'book'
  | 'inaccuracy'
  | 'mistake'
  | 'miss'
  | 'blunder'
  | 'forced';

/**
 * Évaluation toujours exprimée du point de vue des Blancs.
 * `cp` est toujours renseigné (un mat est converti en ±(10000 - n)) ;
 * `mate` est présent si un mat forcé existe (positif = les Blancs matent, 0 = mat sur l'échiquier).
 */
export interface Score {
  cp: number;
  mate?: number;
}

export interface EngineLine {
  move: string; // UCI
  score: Score;
  pv: string[]; // UCI
  depth: number;
}

export interface PositionEval {
  fen: string;
  depth: number;
  lines: EngineLine[];
  terminal?: 'checkmate' | 'stalemate' | 'draw';
}

export type GameSource = 'chesscom' | 'lichess' | 'pgn';
export type TimeClass = 'bullet' | 'blitz' | 'rapid' | 'classical' | 'daily' | 'unknown';
export type GameResult = '1-0' | '0-1' | '1/2-1/2' | '*';

export interface PlayerSummary {
  accuracy: number;
  acpl: number;
  estimatedElo: number;
  moves: number;
  counts: Record<Classification, number>;
  phaseAccuracy: { opening?: number; middlegame?: number; endgame?: number };
  /** Précision quand le joueur était en difficulté (chances de gain < 40 %). */
  defenseAccuracy?: number;
  /** Précision quand le joueur était largement gagnant (chances > 75 %). */
  conversionAccuracy?: number;
  /** Nombre d'occasions tactiques (gain matériel/mat) présentes et nombre manquées. */
  tacticsFound: number;
  tacticsMissed: number;
  /** Erreurs graves (erreur/gaffe/occasion manquée) commises en zeitnot. */
  timeTroubleErrors: number;
  timeTroubleMoves: number;
  /** Pièce déplacée lors des gaffes et erreurs. */
  errorPieces: Partial<Record<PieceType, number>>;
  maxWin: number;
  minWin: number;
}

export interface AnalysisSummary {
  depth: number;
  /** Version du modèle d'estimation Elo (les résumés plus anciens sont recalculés). */
  eloModel?: number;
  analyzedAt: number;
  white: PlayerSummary;
  black: PlayerSummary;
}

export interface StoredGame {
  id: string;
  source: GameSource;
  pgn: string;
  white: string;
  black: string;
  whiteElo?: number;
  blackElo?: number;
  result: GameResult;
  /** Horodatage de la partie (ms) — sert au tri. */
  timestamp: number;
  timeControl?: string;
  timeClass: TimeClass;
  eco?: string;
  opening?: string;
  termination?: string;
  url?: string;
  plies: number;
  /** Couleur du compte lié (si la partie appartient à un compte lié). */
  userColor?: Color;
  accountKey?: string;
  importedAt: number;
  summary?: AnalysisSummary;
  favorite?: boolean;
}

export interface MoveAnalysis {
  ply: number;
  san: string;
  uci: string;
  color: Color;
  piece: PieceType;
  captured?: PieceType;
  fenBefore: string;
  fenAfter: string;
  classification: Classification;
  evalBefore: Score;
  evalAfter: Score;
  bestMove?: string;
  bestSan?: string;
  bestLine: string[]; // SAN
  replyLine: string[]; // meilleure suite adverse après le coup joué (SAN)
  winBefore: number; // 0-100, point de vue du joueur
  winAfter: number;
  accuracy: number;
  cpLoss: number;
  clock?: number; // secondes restantes après le coup
  timeSpent?: number;
  comment: string;
  tags: string[];
  opening?: string;
  sacrifice?: { square: string; piece: PieceType };
}

export interface GameAnalysis {
  gameId: string;
  depth: number;
  createdAt: number;
  startFen: string;
  moves: MoveAnalysis[];
  /** Évaluation de chaque position (index = demi-coup), point de vue des Blancs. */
  evals: Score[];
  opening?: { eco: string; name: string };
  phases: { middlegame: number; endgame: number };
  summary: AnalysisSummary;
  coachIntro: string;
}

export interface LinkedAccount {
  key: string; // "chesscom:username"
  platform: 'chesscom' | 'lichess';
  username: string;
  displayName?: string;
  avatar?: string;
  country?: string;
  title?: string;
  ratings: Partial<Record<'bullet' | 'blitz' | 'rapid' | 'classical' | 'daily' | 'puzzle', number>>;
  lastSync?: number;
  gameCount?: number;
}
