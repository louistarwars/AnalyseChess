import { Chess } from 'chess.js';
import { ChevronFirst, ChevronLast, ChevronLeft, ChevronRight, Cpu, Crosshair, Lightbulb, Pause, Play, RefreshCw, RotateCcw, Undo2, XCircle } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Board, type Arrow } from '../../components/Board';
import { ClassIcon, CLASS_META } from '../../components/ClassIcon';
import { EvalBar, EvalGraph } from '../../components/Eval';
import { PlayerBar } from '../../components/PlayerBar';
import { San } from '../../components/ui';
import { pushBackHandler } from '../../lib/back';
import { getLiveEngine } from '../../lib/engine';
import { formatScore } from '../../lib/evaluation';
import { tapFeedback } from '../../lib/native';
import { playMoveSound, soundForSan } from '../../lib/sound';
import { uciLineToSan } from '../../lib/tactics';
import type { GameAnalysis, PositionEval, StoredGame } from '../../lib/types';
import { useSettings } from '../../store/settings';

interface ExploreMove {
  san: string;
  from: string;
  to: string;
  fen: string;
  color: 'w' | 'b';
}

interface Explore {
  base: number; // index de position de départ
  moves: ExploreMove[];
  idx: number; // nombre de coups joués dans la variante
  label?: string;
}

interface Retry {
  base: number; // index de la position avant le coup à rejouer
  status: 'try' | 'ok' | 'ko';
  fen?: string;
  san?: string;
  from?: string;
  to?: string;
}

const GOOD = new Set(['brilliant', 'great', 'best', 'book', 'forced']);
const RETRYABLE = new Set(['inaccuracy', 'mistake', 'miss', 'blunder']);

export function ReviewMoves({ game, analysis, ply, setPly, orientation: initialOrientation }: { game: StoredGame; analysis: GameAnalysis; ply: number; setPly: (p: number) => void; orientation: 'w' | 'b' }) {
  const { sounds, showArrows } = useSettings();
  const [orientation, setOrientation] = useState(initialOrientation);
  const [explore, setExplore] = useState<Explore | null>(null);
  const [retry, setRetry] = useState<Retry | null>(null);
  const [shake, setShake] = useState(false);
  const [live, setLive] = useState<PositionEval | null>(null);
  const [engineOn, setEngineOn] = useState(false);
  const [playing, setPlaying] = useState(false);
  const stripRef = useRef<HTMLDivElement>(null);
  const moves = analysis.moves;
  const total = moves.length;
  const pos = Math.max(0, Math.min(total, ply));
  const move = pos > 0 ? moves[pos - 1] : undefined;

  const go = useCallback(
    (p: number, withSound = true) => {
      const np = Math.max(0, Math.min(total, p));
      if (np === pos) return;
      setExplore(null);
      setRetry(null);
      setPly(np);
      tapFeedback();
      if (withSound && sounds && np === pos + 1) playMoveSound(soundForSan(moves[np - 1].san));
    },
    [pos, total, setPly, sounds, moves],
  );

  // Lecture automatique
  useEffect(() => {
    if (!playing) return;
    if (pos >= total) {
      setPlaying(false);
      return;
    }
    const t = setTimeout(() => go(pos + 1), 1100);
    return () => clearTimeout(t);
  }, [playing, pos, total, go]);

  // Clavier (utile sur ordinateur)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') go(pos + 1);
      else if (e.key === 'ArrowLeft') go(pos - 1);
      else if (e.key === 'Home') go(0);
      else if (e.key === 'End') go(total);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, pos, total]);

  // Bouton retour Android : quitte d'abord l'exploration / le mode « Réessayer »
  useEffect(() => {
    if (!explore && !retry) return;
    return pushBackHandler(() => {
      if (retry) setRetry(null);
      else setExplore(null);
      return true;
    });
  }, [explore, retry]);

  // Défilement automatique de la bande de coups
  useEffect(() => {
    const el = stripRef.current?.querySelector('.ms-move.current') as HTMLElement | null;
    el?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [pos]);

  // Position affichée
  const exploreMove = explore && explore.idx > 0 ? explore.moves[explore.idx - 1] : undefined;
  const fenAt = (p: number) => (p === 0 ? analysis.startFen : moves[p - 1].fenAfter);
  const fen = retry ? (retry.status === 'ok' && retry.fen ? retry.fen : fenAt(retry.base)) : explore ? (exploreMove ? exploreMove.fen : fenAt(explore.base)) : fenAt(pos);

  // Moteur en direct (exploration ou bouton « moteur »)
  const liveActive = (!!explore || engineOn) && !retry;
  useEffect(() => {
    if (!liveActive) {
      setLive(null);
      return;
    }
    const engine = getLiveEngine();
    setLive(null);
    const job = engine.analyze(fen, { infinite: true, multiPv: 3, onUpdate: (ev) => ev.depth >= 8 && setLive(ev) });
    job.promise.catch(() => undefined);
    const stopTimer = setTimeout(() => job.stop(), 12000);
    return () => {
      clearTimeout(stopTimer);
      job.cancel();
    };
  }, [fen, liveActive]);

  const onBoardMove = (m: { from: string; to: string; promotion?: string }) => {
    const c = new Chess(fen);
    let res;
    try {
      res = c.move(m);
    } catch {
      return;
    }
    if (retry) {
      if (retry.status === 'ok') return;
      const uci = res.from + res.to + (res.promotion ?? '');
      if (uci === moves[retry.base].bestMove) {
        if (sounds) playMoveSound(soundForSan(res.san));
        tapFeedback('medium');
        setRetry({ ...retry, status: 'ok', fen: res.after, san: res.san, from: res.from, to: res.to });
      } else {
        tapFeedback('medium');
        setShake(true);
        setTimeout(() => setShake(false), 450);
        setRetry({ ...retry, status: 'ko', san: res.san });
      }
      return;
    }
    if (sounds) playMoveSound(soundForSan(res.san));
    tapFeedback();
    // Coup identique à la partie : on avance simplement
    if (!explore && pos < total && moves[pos].uci === res.from + res.to + (res.promotion ?? '')) {
      setPly(pos + 1);
      return;
    }
    const nm: ExploreMove = { san: res.san, from: res.from, to: res.to, fen: res.after, color: res.color };
    if (!explore) setExplore({ base: pos, moves: [nm], idx: 1 });
    else setExplore({ ...explore, moves: [...explore.moves.slice(0, explore.idx), nm], idx: explore.idx + 1 });
  };

  const showBestLine = () => {
    if (!move?.bestLine.length) return;
    const c = new Chess(move.fenBefore);
    const seq: ExploreMove[] = [];
    for (const san of move.bestLine.slice(0, 10)) {
      try {
        const r = c.move(san);
        seq.push({ san: r.san, from: r.from, to: r.to, fen: r.after, color: r.color });
      } catch {
        break;
      }
    }
    if (!seq.length) return;
    if (sounds) playMoveSound(soundForSan(seq[0].san));
    setExplore({ base: pos - 1, moves: seq, idx: 1, label: 'Meilleure suite' });
  };

  // Flèches
  const arrows: Arrow[] = [];
  if (retry) {
    /* pas d'indice pendant l'exercice */
  } else if (explore || engineOn) {
    live?.lines.slice(0, 3).forEach((l, i) => arrows.push({ from: l.move.slice(0, 2), to: l.move.slice(2, 4), color: i === 0 ? 'rgba(129,182,76,0.9)' : 'rgba(120,160,220,0.75)', opacity: i === 0 ? 1 : 0.55, width: i === 0 ? 2.4 : 1.8 }));
  } else if (showArrows && move && move.bestMove && !GOOD.has(move.classification)) {
    arrows.push({ from: move.bestMove.slice(0, 2), to: move.bestMove.slice(2, 4), color: 'rgba(129,182,76,0.88)' });
  }

  const prevOfRetry = retry && retry.base > 0 ? moves[retry.base - 1] : undefined;
  const lastMove = retry
    ? retry.status === 'ok' && retry.from && retry.to
      ? { from: retry.from, to: retry.to }
      : prevOfRetry
        ? { from: prevOfRetry.uci.slice(0, 2), to: prevOfRetry.uci.slice(2, 4) }
        : undefined
    : exploreMove
      ? { from: exploreMove.from, to: exploreMove.to }
      : !explore && move
        ? { from: move.uci.slice(0, 2), to: move.uci.slice(2, 4) }
        : undefined;
  const badge = retry
    ? retry.status === 'ok' && retry.to
      ? { square: retry.to, cls: 'best' as const, key: 'retry' }
      : undefined
    : !explore && move
      ? { square: move.uci.slice(2, 4), cls: move.classification, key: pos }
      : undefined;

  const barScore = retry ? analysis.evals[retry.status === 'ok' ? retry.base + 1 : retry.base] : liveActive && live?.lines[0] ? live.lines[0].score : analysis.evals[pos];

  // Pendules à la position courante
  const clockFor = (c: 'w' | 'b') => {
    for (let i = pos - 1; i >= 0; i--) if (moves[i].color === c && moves[i].clock !== undefined) return moves[i].clock;
    const first = moves.find((m) => m.color === c && m.clock !== undefined);
    return first ? first.clock! + (first.timeSpent ?? 0) : undefined;
  };
  const top = orientation === 'w' ? 'b' : 'w';
  const turn = fen.split(' ')[1] as 'w' | 'b';
  const bar = (c: 'w' | 'b') => <PlayerBar name={c === 'w' ? game.white : game.black} elo={c === 'w' ? game.whiteElo : game.blackElo} color={c} fen={fen} clock={clockFor(c)} active={turn === c && !explore} />;

  const markers = useMemo(() => moves.filter((m) => ['brilliant', 'great', 'blunder', 'miss', 'mistake'].includes(m.classification)).map((m) => ({ ply: m.ply, cls: m.classification })), [moves]);

  return (
    <div className="review-moves">
      {bar(top)}
      <div className={`board-row ${shake ? 'shake' : ''}`}>
        <EvalBar score={barScore} orientation={orientation} result={pos === total && !retry && !explore ? game.result : undefined} />
        <Board fen={fen} orientation={orientation} lastMove={lastMove} arrows={arrows} badge={badge} interactive onMove={onBoardMove} />
      </div>
      {bar(orientation)}

      {retry ? (
        <RetryCard
          retry={retry}
          color={moves[retry.base].color}
          played={moves[retry.base].san}
          bestSan={moves[retry.base].bestSan}
          onRetry={() => setRetry({ base: retry.base, status: 'try' })}
          onSolution={() => {
            setRetry(null);
            showBestLine();
          }}
          onExit={() => setRetry(null)}
          onContinue={() => {
            setRetry(null);
            go(retry.base + 2);
          }}
        />
      ) : explore ? (
        <div className="coach-card explore-card">
          <div className="row">
            <Cpu size={18} color="var(--accent-hi)" />
            <b className="grow">{explore.label ?? 'Exploration'}</b>
            <span className="eval-chip num">{live?.lines[0] ? formatScore(live.lines[0].score) : '…'}</span>
            <button className="btn secondary sm" onClick={() => setExplore(null)}>
              <Undo2 size={15} /> Partie
            </button>
          </div>
          <div className="explore-moves">
            {explore.moves.map((m, i) => (
              <button key={i} className={`ms-move ${i === explore.idx - 1 ? 'current' : ''}`} onClick={() => setExplore({ ...explore, idx: i + 1 })}>
                <San san={m.san} color={m.color} />
              </button>
            ))}
          </div>
          <EngineLines ev={live} fen={fen} />
        </div>
      ) : (
        <CoachCard analysis={analysis} pos={pos} onBest={showBestLine} onRetry={() => setRetry({ base: pos - 1, status: 'try' })} />
      )}

      {!explore && engineOn && (
        <div className="card tight engine-card">
          <EngineLines ev={live} fen={fen} />
        </div>
      )}

      <div className="move-strip" ref={stripRef}>
        <button className={`ms-move start ${pos === 0 ? 'current' : ''}`} onClick={() => go(0)}>
          Début
        </button>
        {moves.map((m, i) => (
          <button key={i} className={`ms-move ${pos === i + 1 && !explore ? 'current' : ''}`} onClick={() => go(i + 1, false)}>
            {m.color === 'w' && <span className="ms-num">{Math.floor(i / 2) + 1}.</span>}
            <San san={m.san} color={m.color} />
            {m.classification !== 'best' && m.classification !== 'excellent' && m.classification !== 'good' && <ClassIcon cls={m.classification} size={14} />}
          </button>
        ))}
      </div>

      <EvalGraph evals={analysis.evals} current={pos} onSelect={(p) => go(p, false)} markers={markers} height={46} phases={analysis.phases} />

      <div className="controls">
        <button className="ctrl-btn" onClick={() => setOrientation(orientation === 'w' ? 'b' : 'w')} aria-label="Retourner">
          <RefreshCw size={19} />
        </button>
        <button className="ctrl-btn" onClick={() => go(0)} aria-label="Début">
          <ChevronFirst size={24} />
        </button>
        <button className="ctrl-btn big" onClick={() => (explore ? setExplore({ ...explore, idx: Math.max(0, explore.idx - 1) }) : go(pos - 1))} aria-label="Précédent">
          <ChevronLeft size={30} />
        </button>
        <button
          className="ctrl-btn big primary"
          onClick={() => {
            if (explore) {
              if (explore.idx < explore.moves.length) {
                const next = explore.moves[explore.idx];
                if (sounds) playMoveSound(soundForSan(next.san));
                setExplore({ ...explore, idx: explore.idx + 1 });
              }
            } else go(pos + 1);
          }}
          aria-label="Suivant"
        >
          <ChevronRight size={30} />
        </button>
        <button className="ctrl-btn" onClick={() => go(total)} aria-label="Fin">
          <ChevronLast size={24} />
        </button>
        <button className={`ctrl-btn ${playing ? 'on' : ''}`} onClick={() => setPlaying(!playing)} aria-label="Lecture">
          {playing ? <Pause size={19} /> : <Play size={19} />}
        </button>
        <button className={`ctrl-btn ${engineOn ? 'on' : ''}`} onClick={() => setEngineOn(!engineOn)} aria-label="Moteur">
          <Lightbulb size={19} />
        </button>
      </div>
    </div>
  );
}

function EngineLines({ ev, fen }: { ev: PositionEval | null; fen: string }) {
  if (!ev) {
    return (
      <div className="engine-lines">
        <div className="row dim small">
          <div className="spinner" style={{ width: 14, height: 14 }} /> Stockfish réfléchit…
        </div>
      </div>
    );
  }
  const turn = fen.split(' ')[1] as 'w' | 'b';
  return (
    <div className="engine-lines">
      {ev.lines.slice(0, 3).map((l, i) => {
        const { san } = uciLineToSan(fen, l.pv, 8);
        return (
          <div key={i} className="engine-line">
            <span className={`eval-chip num ${l.score.cp >= 0 ? 'w' : 'b'}`}>{formatScore(l.score)}</span>
            <span className="el-moves">
              {san.map((s, j) => (
                <San key={j} san={s} color={(j % 2 === 0) === (turn === 'w') ? 'w' : 'b'} />
              ))}
            </span>
          </div>
        );
      })}
      <div className="tiny dim">Profondeur {ev.depth}</div>
    </div>
  );
}

function CoachCard({ analysis, pos, onBest, onRetry }: { analysis: GameAnalysis; pos: number; onBest: () => void; onRetry: () => void }) {
  if (pos === 0) {
    return (
      <div className="coach-card">
        <div className="row">
          <div className="coach-avatar sm">
            <img src="pieces/cburnett/wN.svg" alt="" />
          </div>
          <div className="grow">
            <b>Prêt pour la revue ?</b>
            <div className="muted small">{analysis.opening ? `${analysis.opening.eco} · ${analysis.opening.name}` : 'Avancez coup par coup pour découvrir le bilan de chaque coup.'}</div>
          </div>
        </div>
      </div>
    );
  }
  const m = analysis.moves[pos - 1];
  const meta = CLASS_META[m.classification];
  const bad = !GOOD.has(m.classification) && m.bestSan && m.bestSan !== m.san;
  return (
    <div className="coach-card" style={{ ['--cls' as string]: meta.color }} key={pos}>
      <div className="row" style={{ alignItems: 'flex-start' }}>
        <ClassIcon cls={m.classification} size={34} shadow />
        <div className="grow" style={{ minWidth: 0 }}>
          <div className="row" style={{ gap: 8 }}>
            <span className="cc-title">
              <San san={m.san} color={m.color} /> <span style={{ color: meta.color }}>{meta.label.toLowerCase() === 'théorique' ? 'est théorique' : `· ${meta.label}`}</span>
            </span>
            <span className="grow" />
            <span className={`eval-chip num ${m.evalAfter.cp >= 0 ? 'w' : 'b'}`}>{formatScore(m.evalAfter)}</span>
          </div>
          <div className="cc-text">{m.comment}</div>
          {bad && (
            <div className="cc-actions">
              {RETRYABLE.has(m.classification) && (
                <button className="best-btn retry-btn" onClick={onRetry}>
                  <RotateCcw size={15} /> Réessayer
                </button>
              )}
              <button className="best-btn" onClick={onBest}>
                <ClassIcon cls="best" size={16} /> <San san={m.bestSan!} color={m.color} />
                <span className="dim">· suite</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function RetryCard({
  retry,
  color,
  played,
  bestSan,
  onRetry,
  onSolution,
  onExit,
  onContinue,
}: {
  retry: Retry;
  color: 'w' | 'b';
  played: string;
  bestSan?: string;
  onRetry: () => void;
  onSolution: () => void;
  onExit: () => void;
  onContinue: () => void;
}) {
  const side = color === 'w' ? 'les Blancs' : 'les Noirs';
  if (retry.status === 'ok') {
    return (
      <div className="coach-card" style={{ ['--cls' as string]: 'var(--c-best)' }} key="ok">
        <div className="row" style={{ alignItems: 'flex-start' }}>
          <ClassIcon cls="best" size={34} shadow />
          <div className="grow">
            <div className="cc-title">Bien joué !</div>
            <div className="cc-text">
              <San san={retry.san ?? bestSan ?? ''} color={color} /> était bien le meilleur coup.
            </div>
            <div className="cc-actions">
              <button className="best-btn" onClick={onContinue}>
                Continuer la revue <ChevronRight size={15} />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="coach-card retry-card" style={{ ['--cls' as string]: retry.status === 'ko' ? 'var(--c-blunder)' : 'var(--blue)' }} key={retry.status + (retry.san ?? '')}>
      <div className="row" style={{ alignItems: 'flex-start' }}>
        {retry.status === 'ko' ? <XCircle size={32} color="#ff7769" style={{ flexShrink: 0 }} /> : <Crosshair size={32} color="#7fb2ff" style={{ flexShrink: 0 }} />}
        <div className="grow">
          <div className="cc-title">
            {retry.status === 'ko' ? (
              <>
                <San san={retry.san ?? ''} color={color} /> n'est pas le meilleur coup
              </>
            ) : (
              `Trouvez le meilleur coup pour ${side}`
            )}
          </div>
          <div className="cc-text">
            {retry.status === 'ko' ? 'Cherchez encore : pensez aux échecs, aux prises et aux menaces.' : (
              <>
                Dans la partie, <San san={played} color={color} /> a été joué. Faites mieux !
              </>
            )}
          </div>
          <div className="cc-actions">
            {retry.status === 'ko' && (
              <button className="best-btn retry-btn" onClick={onRetry}>
                <RotateCcw size={15} /> Réessayer
              </button>
            )}
            <button className="best-btn" onClick={onSolution}>
              <Lightbulb size={15} /> Solution
            </button>
            <button className="best-btn ghost-btn" onClick={onExit}>
              Annuler
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
