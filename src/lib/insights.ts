import { mean } from './accuracy';
import { aggregateElo, projectRating } from './elo';
import { resultForColor } from './importer';
import type { Classification, Color, PieceType, PlayerSummary, StoredGame, TimeClass } from './types';

export interface Record3 {
  win: number;
  draw: number;
  loss: number;
}

export interface Skill {
  key: string;
  label: string;
  score: number; // 0-100
  detail: string;
}

export interface InsightText {
  title: string;
  detail: string;
  advice?: string;
  skill?: string;
}

export interface OpeningStat {
  name: string;
  games: number;
  record: Record3;
  score: number; // % de points
  accuracy?: number;
}

export interface Insights {
  totalGames: number;
  analyzedGames: number;
  record: Record3;
  byColor: Record<Color, Record3>;
  byTimeClass: Partial<Record<TimeClass, Record3 & { games: number }>>;
  estimatedElo?: { elo: number; margin: number; n: number };
  eloSeries: { t: number; elo: number; accuracy: number }[];
  ratingSeries: { t: number; r: number; tc: TimeClass }[];
  mainTimeClass?: TimeClass;
  currentRating?: number;
  projection?: { slopePerMonth: number; projected: number };
  accuracy?: number;
  accuracyByColor: Partial<Record<Color, number>>;
  phases: { opening?: number; middlegame?: number; endgame?: number };
  perGame: Partial<Record<Classification, number>>;
  skills: Skill[];
  strengths: InsightText[];
  weaknesses: InsightText[];
  openings: { w: OpeningStat[]; b: OpeningStat[] };
  errorPieces: Partial<Record<PieceType, number>>;
  streak?: { type: 'win' | 'loss'; count: number };
}

const emptyRecord = (): Record3 => ({ win: 0, draw: 0, loss: 0 });

function add(r: Record3, res: 'win' | 'loss' | 'draw' | 'unknown') {
  if (res !== 'unknown') r[res]++;
}

const clamp = (x: number) => Math.max(0, Math.min(100, Math.round(x)));
const accToScore = (acc: number) => clamp((acc - 55) * (100 / 40));

const SKILL_TEXT: Record<string, { strong: string; weak: string; advice: string }> = {
  opening: {
    strong: 'Vos ouvertures sont solides',
    weak: 'Vos débuts de partie manquent de précision',
    advice: 'Travaillez 2 ou 3 ouvertures avec leurs idées principales plutôt que de mémoriser des coups.',
  },
  middlegame: {
    strong: 'Vous êtes à l’aise en milieu de jeu',
    weak: 'Le milieu de jeu vous coûte des points',
    advice: 'Avant chaque coup, cherchez les menaces adverses : échecs, prises et attaques.',
  },
  endgame: {
    strong: 'Excellente technique de finale',
    weak: 'Vos finales sont à travailler',
    advice: 'Étudiez les finales de pions et de tours élémentaires : elles reviennent sans cesse.',
  },
  tactics: {
    strong: 'Vous voyez bien les tactiques',
    weak: 'Vous manquez des occasions tactiques',
    advice: 'Faites 10 à 15 minutes de problèmes tactiques par jour (fourchettes, clouages, attaques doubles).',
  },
  defense: {
    strong: 'Vous vous défendez avec ténacité',
    weak: 'Vous craquez dans les positions difficiles',
    advice: 'Dans une position inférieure, cherchez à compliquer et à créer du contre-jeu plutôt que d’attendre.',
  },
  conversion: {
    strong: 'Vous concluez bien vos avantages',
    weak: 'Vous laissez filer des positions gagnantes',
    advice: 'Quand vous êtes gagnant, simplifiez : échangez les pièces et éliminez le contre-jeu adverse.',
  },
  time: {
    strong: 'Bonne gestion de la pendule',
    weak: 'Le zeitnot vous fait commettre des erreurs',
    advice: 'Gardez du temps pour la fin de partie : évitez de réfléchir longtemps sur des coups évidents.',
  },
  composure: {
    strong: 'Vous faites très peu de gaffes',
    weak: 'Trop de gaffes dans vos parties',
    advice: 'Prenez l’habitude d’une vérification « sécurité » avant de jouer : quelles pièces sont en prise ?',
  },
};

export function computeInsights(games: StoredGame[]): Insights {
  const mine = games.filter((g) => g.userColor);
  const record = emptyRecord();
  const byColor: Record<Color, Record3> = { w: emptyRecord(), b: emptyRecord() };
  const byTimeClass: Insights['byTimeClass'] = {};
  const ratingSeries: Insights['ratingSeries'] = [];
  const openingMap: Record<Color, Map<string, { games: number; record: Record3; acc: number[] }>> = { w: new Map(), b: new Map() };

  for (const g of mine) {
    const c = g.userColor!;
    const res = resultForColor(g.result, c);
    add(record, res);
    add(byColor[c], res);
    const tc = (byTimeClass[g.timeClass] ??= { ...emptyRecord(), games: 0 });
    tc.games++;
    add(tc, res);
    const r = c === 'w' ? g.whiteElo : g.blackElo;
    if (r) ratingSeries.push({ t: g.timestamp, r, tc: g.timeClass });
    const family = (g.opening || 'Ouverture inconnue').split(':')[0].trim();
    const o = openingMap[c].get(family) ?? { games: 0, record: emptyRecord(), acc: [] };
    o.games++;
    add(o.record, res);
    const s = g.summary?.[c === 'w' ? 'white' : 'black'];
    if (s) o.acc.push(s.accuracy);
    openingMap[c].set(family, o);
  }
  ratingSeries.sort((a, b) => a.t - b.t);

  // Cadence principale
  const mainTimeClass = (Object.entries(byTimeClass) as [TimeClass, { games: number }][]).sort((a, b) => b[1].games - a[1].games)[0]?.[0];
  const mainSeries = ratingSeries.filter((p) => p.tc === mainTimeClass);
  const currentRating = mainSeries[mainSeries.length - 1]?.r;
  const projection = projectRating(mainSeries.map((p) => ({ t: p.t, r: p.r })).slice(-60));

  // Séries (victoires / défaites consécutives)
  const chrono = [...mine].sort((a, b) => b.timestamp - a.timestamp);
  let streak: Insights['streak'];
  for (const g of chrono) {
    const res = resultForColor(g.result, g.userColor!);
    if (res !== 'win' && res !== 'loss') break;
    if (!streak) streak = { type: res, count: 1 };
    else if (streak.type === res) streak.count++;
    else break;
  }

  // Parties analysées
  const analyzed = mine.filter((g) => g.summary);
  const sums: { s: PlayerSummary; g: StoredGame }[] = analyzed.map((g) => ({ s: g.summary![g.userColor === 'w' ? 'white' : 'black'], g }));
  const eloSeries = sums
    .map(({ s, g }) => ({ t: g.timestamp, elo: s.estimatedElo, accuracy: s.accuracy, moves: s.moves }))
    .sort((a, b) => a.t - b.t);
  const estimatedElo = aggregateElo(eloSeries.map((x) => ({ elo: x.elo, moves: x.moves, timestamp: x.t })));
  const accuracy = mean(sums.map((x) => x.s.accuracy));
  const accuracyByColor: Insights['accuracyByColor'] = {
    w: mean(sums.filter((x) => x.g.userColor === 'w').map((x) => x.s.accuracy)),
    b: mean(sums.filter((x) => x.g.userColor === 'b').map((x) => x.s.accuracy)),
  };
  const phaseVals = (k: 'opening' | 'middlegame' | 'endgame') => sums.map((x) => x.s.phaseAccuracy[k]).filter((v): v is number => v !== undefined);
  const phases = { opening: mean(phaseVals('opening')), middlegame: mean(phaseVals('middlegame')), endgame: mean(phaseVals('endgame')) };

  const perGame: Insights['perGame'] = {};
  if (sums.length) {
    for (const k of ['brilliant', 'great', 'best', 'inaccuracy', 'mistake', 'miss', 'blunder'] as Classification[]) {
      perGame[k] = sums.reduce((a, x) => a + x.s.counts[k], 0) / sums.length;
    }
  }
  const errorPieces: Insights['errorPieces'] = {};
  for (const { s } of sums) for (const [p, n] of Object.entries(s.errorPieces)) errorPieces[p as PieceType] = (errorPieces[p as PieceType] ?? 0) + (n ?? 0);

  // --- Compétences (radar) ---
  const skills: Skill[] = [];
  const fmt = (x: number) => `${Math.round(x)} %`;
  if (phases.opening !== undefined) skills.push({ key: 'opening', label: 'Ouverture', score: accToScore(phases.opening), detail: `Précision ${fmt(phases.opening)}` });
  if (phases.middlegame !== undefined) skills.push({ key: 'middlegame', label: 'Milieu de jeu', score: accToScore(phases.middlegame), detail: `Précision ${fmt(phases.middlegame)}` });
  if (phases.endgame !== undefined) skills.push({ key: 'endgame', label: 'Finale', score: accToScore(phases.endgame), detail: `Précision ${fmt(phases.endgame)}` });
  const found = sums.reduce((a, x) => a + x.s.tacticsFound, 0);
  const missed = sums.reduce((a, x) => a + x.s.tacticsMissed, 0);
  if (found + missed >= 3) {
    const rate = (found / (found + missed)) * 100;
    skills.push({ key: 'tactics', label: 'Tactique', score: clamp(rate * 0.9 + (perGame.brilliant ?? 0) * 20 + (perGame.great ?? 0) * 5), detail: `${found} occasions saisies sur ${found + missed}` });
  }
  const def = sums.map((x) => x.s.defenseAccuracy).filter((v): v is number => v !== undefined);
  if (def.length >= 2) skills.push({ key: 'defense', label: 'Défense', score: accToScore(mean(def)! + 5), detail: `Précision en position difficile ${fmt(mean(def)!)}` });
  const winning = sums.filter((x) => x.s.maxWin >= 85);
  if (winning.length >= 2) {
    const converted = winning.filter((x) => resultForColor(x.g.result, x.g.userColor!) === 'win').length / winning.length;
    const conv = sums.map((x) => x.s.conversionAccuracy).filter((v): v is number => v !== undefined);
    const convAcc = mean(conv) ?? 80;
    skills.push({
      key: 'conversion',
      label: 'Conversion',
      score: clamp(converted * 70 + accToScore(convAcc) * 0.3),
      detail: `${Math.round(converted * 100)} % des positions gagnantes converties`,
    });
  }
  const ttMoves = sums.reduce((a, x) => a + x.s.timeTroubleMoves, 0);
  const ttErrors = sums.reduce((a, x) => a + x.s.timeTroubleErrors, 0);
  const clockGames = sums.filter((x) => x.s.timeTroubleMoves > 0).length;
  if (ttMoves >= 8) {
    skills.push({ key: 'time', label: 'Pendule', score: clamp(100 - (ttErrors / ttMoves) * 400 - (clockGames / sums.length) * 20), detail: `${ttErrors} erreurs graves en zeitnot` });
  }
  if (sums.length) {
    const bpg = perGame.blunder ?? 0;
    skills.push({ key: 'composure', label: 'Sang-froid', score: clamp(100 - bpg * 30 - (perGame.mistake ?? 0) * 8), detail: `${bpg.toFixed(1).replace('.', ',')} gaffe par partie` });
  }

  const ranked = [...skills].sort((a, b) => b.score - a.score);
  const toText = (s: Skill, strong: boolean): InsightText => ({
    title: strong ? SKILL_TEXT[s.key].strong : SKILL_TEXT[s.key].weak,
    detail: s.detail,
    advice: strong ? undefined : SKILL_TEXT[s.key].advice,
    skill: s.key,
  });
  const strengths = ranked.filter((s) => s.score >= 55).slice(0, 3).map((s) => toText(s, true));
  const weaknesses = ranked
    .slice()
    .reverse()
    .filter((s) => s.score < 70 && !strengths.some((x) => x.skill === s.key))
    .slice(0, 3)
    .map((s) => toText(s, false));

  // Pièce la plus souvent impliquée dans les erreurs
  const pieceEntries = Object.entries(errorPieces).sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0));
  const totalErr = pieceEntries.reduce((a, [, n]) => a + (n ?? 0), 0);
  if (pieceEntries.length && totalErr >= 5) {
    const [p, n] = pieceEntries[0];
    const share = (n ?? 0) / totalErr;
    const names: Record<string, string> = { p: 'vos pions', n: 'vos cavaliers', b: 'vos fous', r: 'vos tours', q: 'votre dame', k: 'votre roi' };
    if (share >= 0.3 && weaknesses.length < 4) {
      weaknesses.push({
        title: `Attention avec ${names[p]}`,
        detail: `${Math.round(share * 100)} % de vos erreurs graves concernent ${names[p]}`,
        advice: 'Avant de déplacer cette pièce, vérifiez sa sécurité et ce qu’elle cessera de défendre.',
      });
    }
  }

  const openingsFor = (c: Color): OpeningStat[] =>
    [...openingMap[c].entries()]
      .map(([name, o]) => ({
        name,
        games: o.games,
        record: o.record,
        score: o.games ? ((o.record.win + o.record.draw / 2) / o.games) * 100 : 0,
        accuracy: mean(o.acc),
      }))
      .sort((a, b) => b.games - a.games)
      .slice(0, 8);

  return {
    totalGames: mine.length,
    analyzedGames: analyzed.length,
    record,
    byColor,
    byTimeClass,
    estimatedElo,
    eloSeries: eloSeries.map(({ t, elo, accuracy }) => ({ t, elo, accuracy })),
    ratingSeries,
    mainTimeClass,
    currentRating,
    projection,
    accuracy,
    accuracyByColor,
    phases,
    perGame,
    skills,
    strengths,
    weaknesses,
    openings: { w: openingsFor('w'), b: openingsFor('b') },
    errorPieces,
    streak,
  };
}
