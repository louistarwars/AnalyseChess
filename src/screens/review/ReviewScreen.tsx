import { ArrowLeft, BarChart3, ListChecks, Share2, Star } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Board } from '../../components/Board';
import { EvalBar } from '../../components/Eval';
import { Ring } from '../../components/ui';
import { getAnalysis } from '../../lib/db';
import { parseGame } from '../../lib/pgn';
import type { GameAnalysis } from '../../lib/types';
import { onAnalysisDone, useApp } from '../../store/app';
import { DEPTHS, useSettings } from '../../store/settings';
import { ReviewMoves } from './ReviewMoves';
import { ReviewSummary } from './ReviewSummary';
import './review.css';

export function ReviewScreen({ gameId, initialPly }: { gameId: string; initialPly?: number }) {
  const game = useApp((s) => s.games.find((g) => g.id === gameId));
  const current = useApp((s) => s.current);
  const queue = useApp((s) => s.queue);
  const { pop, enqueueAnalysis, toggleFavorite, showToast } = useApp();
  const { autoAnalyze, depthPreset } = useSettings();
  const [analysis, setAnalysis] = useState<GameAnalysis | null | undefined>(undefined);
  const [mode, setMode] = useState<'summary' | 'moves'>(initialPly !== undefined ? 'moves' : 'summary');
  const [ply, setPly] = useState(initialPly ?? 0);

  useEffect(() => {
    let alive = true;
    getAnalysis(gameId).then((a) => {
      if (!alive) return;
      setAnalysis(a ?? null);
      if (!a && autoAnalyze) enqueueAnalysis([gameId], true);
    });
    const off = onAnalysisDone((a) => {
      if (a.gameId === gameId) setAnalysis(a);
    });
    return () => {
      alive = false;
      off();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId]);

  const parsed = useMemo(() => {
    try {
      return game ? parseGame(game.pgn) : null;
    } catch {
      return null;
    }
  }, [game]);

  if (!game || !parsed) {
    return (
      <div className="screen full">
        <div className="topbar">
          <button className="icon-btn" onClick={pop}>
            <ArrowLeft size={20} />
          </button>
          <h1>Partie introuvable</h1>
        </div>
      </div>
    );
  }

  const analyzing = current?.gameId === gameId;
  const queued = queue.includes(gameId);
  const orientation = game.userColor ?? 'w';

  const header = (
    <div className="topbar review-top">
      <button className="icon-btn" onClick={pop} aria-label="Retour">
        <ArrowLeft size={20} />
      </button>
      <div className="grow">
        <h1 className="review-title">{analysis ? 'Bilan de la partie' : 'Analyse'}</h1>
        <div className="dim tiny ellipsis">
          {game.white} – {game.black}
        </div>
      </div>
      <button className="icon-btn ghost" onClick={() => toggleFavorite(game.id)} aria-label="Favori">
        <Star size={20} fill={game.favorite ? '#f5c04a' : 'none'} color={game.favorite ? '#f5c04a' : 'currentColor'} />
      </button>
      <button
        className="icon-btn ghost"
        aria-label="Partager"
        onClick={async () => {
          try {
            if (navigator.share) await navigator.share({ title: `${game.white} – ${game.black}`, text: game.pgn });
            else {
              await navigator.clipboard.writeText(game.pgn);
              showToast('PGN copié dans le presse-papiers', 'success');
            }
          } catch {
            /* annulé */
          }
        }}
      >
        <Share2 size={19} />
      </button>
    </div>
  );

  if (analysis === undefined) {
    return (
      <div className="screen full">
        {header}
        <div className="skeleton" style={{ aspectRatio: '1', width: '100%' }} />
      </div>
    );
  }

  if (!analysis) {
    const p = analyzing ? current?.progress : undefined;
    const pct = p ? Math.round((p.done / p.total) * 100) : 0;
    const fen = p?.fen ?? parsed.fens[parsed.fens.length - 1];
    const lastIdx = p ? p.ply : parsed.moves.length;
    const lm = lastIdx > 0 ? parsed.moves[lastIdx - 1] : undefined;
    return (
      <div className="screen full">
        {header}
        <div className="analyzing">
          <div className="board-row">
            <EvalBar score={p?.score} orientation={orientation} />
            <Board fen={fen} orientation={orientation} lastMove={lm ? { from: lm.from, to: lm.to } : undefined} />
          </div>
          <div className="card analyzing-card rise">
            {analyzing || queued ? (
              <>
                <Ring value={pct} size={84} stroke={8}>
                  <span className="num" style={{ fontSize: 22, fontWeight: 800 }}>
                    {pct}%
                  </span>
                </Ring>
                <div className="grow">
                  <h3>{analyzing ? 'Analyse en cours…' : "En file d'attente…"}</h3>
                  <p className="muted small" style={{ margin: '4px 0 0' }}>
                    {analyzing && p ? `Position ${p.done} / ${p.total} · Stockfish 19 · profondeur ${DEPTHS[depthPreset].depth}` : 'Une autre partie est en cours d’analyse.'}
                  </p>
                  <div className="progress" style={{ marginTop: 12 }}>
                    <div style={{ width: `${pct}%` }} />
                  </div>
                </div>
              </>
            ) : (
              <div className="col" style={{ width: '100%', alignItems: 'stretch' }}>
                <h3>Cette partie n'est pas encore analysée</h3>
                <p className="muted small" style={{ margin: 0 }}>
                  Stockfish va évaluer chaque coup et produire un bilan complet : précision, coups brillants, erreurs, Elo estimé…
                </p>
                <button className="btn primary lg block" onClick={() => enqueueAnalysis([gameId], true)}>
                  <BarChart3 size={20} /> Lancer l'analyse
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="screen full review-screen">
      {header}
      <div className="segmented review-tabs">
        <button className={mode === 'summary' ? 'active' : ''} onClick={() => setMode('summary')}>
          <BarChart3 size={16} /> Bilan
        </button>
        <button className={mode === 'moves' ? 'active' : ''} onClick={() => setMode('moves')}>
          <ListChecks size={16} /> Coups
        </button>
      </div>
      {mode === 'summary' ? (
        <ReviewSummary
          game={game}
          analysis={analysis}
          onStart={(p) => {
            setPly(p ?? 0);
            setMode('moves');
          }}
        />
      ) : (
        <ReviewMoves game={game} analysis={analysis} ply={ply} setPly={setPly} orientation={orientation} />
      )}
    </div>
  );
}
