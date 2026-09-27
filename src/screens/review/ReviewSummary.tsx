import { ChevronRight, Play, Sparkles } from 'lucide-react';
import { ClassIcon, CLASS_META } from '../../components/ClassIcon';
import { EvalGraph } from '../../components/Eval';
import { Avatar, CountUp, San } from '../../components/ui';
import { moveLabel } from '../../lib/coach';
import type { Classification, GameAnalysis, StoredGame } from '../../lib/types';

const TABLE: Classification[] = ['brilliant', 'great', 'best', 'excellent', 'good', 'book', 'inaccuracy', 'mistake', 'miss', 'blunder'];

function phaseIcon(acc?: number): Classification | null {
  if (acc === undefined) return null;
  if (acc >= 92) return 'best';
  if (acc >= 84) return 'excellent';
  if (acc >= 74) return 'good';
  if (acc >= 62) return 'inaccuracy';
  if (acc >= 50) return 'mistake';
  return 'blunder';
}

export function ReviewSummary({ game, analysis, onStart }: { game: StoredGame; analysis: GameAnalysis; onStart: (ply?: number) => void }) {
  const { white, black } = analysis.summary;
  const keyMoves = analysis.moves.filter((m) => ['brilliant', 'great', 'blunder', 'miss', 'mistake'].includes(m.classification));
  const markers = keyMoves.map((m) => ({ ply: m.ply, cls: m.classification }));
  const resultTxt = game.result === '1-0' ? '1-0' : game.result === '0-1' ? '0-1' : game.result === '1/2-1/2' ? '½-½' : '*';

  return (
    <div className="review-summary page-enter">
      <div className="coach-bubble rise">
        <div className="coach-avatar">
          <img src="pieces/cburnett/wN.svg" alt="" />
        </div>
        <div className="coach-text">
          <div className="coach-name">
            <Sparkles size={13} /> Coach
          </div>
          {analysis.coachIntro || 'Voici le bilan de votre partie.'}
        </div>
      </div>

      <div className="card graph-card rise" style={{ animationDelay: '60ms' }}>
        <EvalGraph evals={analysis.evals} current={-1} markers={markers} height={96} phases={analysis.phases} onSelect={(p) => onStart(p)} />
      </div>

      <div className="players-grid rise" style={{ animationDelay: '110ms' }}>
        {(['w', 'b'] as const).map((c) => {
          const s = c === 'w' ? white : black;
          const name = c === 'w' ? game.white : game.black;
          const elo = c === 'w' ? game.whiteElo : game.blackElo;
          return (
            <div key={c} className="player-col">
              <Avatar name={name} size={48} />
              <div className="pc-name ellipsis">{name}</div>
              <div className="dim tiny">{elo ? `${elo} Elo` : c === 'w' ? 'Blancs' : 'Noirs'}</div>
              <div className={`acc-box ${c === 'w' ? 'light' : 'dark'}`}>
                <div className="acc-value num">
                  <CountUp value={s.accuracy} decimals={1} />
                </div>
                <div className="acc-label">Précision</div>
              </div>
            </div>
          );
        })}
        <div className="vs-result num">{resultTxt}</div>
      </div>

      <div className="card class-table rise" style={{ animationDelay: '160ms' }}>
        {TABLE.map((cls) => {
          const w = white.counts[cls];
          const b = black.counts[cls];
          return (
            <div key={cls} className={`ct-row ${w + b === 0 ? 'zero' : ''}`}>
              <span className="ct-count num" style={{ color: w ? CLASS_META[cls].color : undefined }}>
                {w}
              </span>
              <span className="ct-label">
                <ClassIcon cls={cls} size={22} />
                {CLASS_META[cls].plural}
              </span>
              <span className="ct-count num" style={{ color: b ? CLASS_META[cls].color : undefined }}>
                {b}
              </span>
            </div>
          );
        })}
      </div>

      <div className="card rating-card rise" style={{ animationDelay: '210ms' }}>
        <div className="rc-title">Performance estimée</div>
        <div className="rc-row">
          <div className="rc-elo num">
            <CountUp value={white.estimatedElo} />
          </div>
          <div className="rc-mid dim tiny">Elo de la partie</div>
          <div className="rc-elo num">
            <CountUp value={black.estimatedElo} />
          </div>
        </div>
        <div className="phase-table">
          {(['opening', 'middlegame', 'endgame'] as const).map((ph) => {
            const iw = phaseIcon(white.phaseAccuracy[ph]);
            const ib = phaseIcon(black.phaseAccuracy[ph]);
            if (!iw && !ib) return null;
            return (
              <div key={ph} className="phase-row">
                <span className="phase-cell">{iw ? <ClassIcon cls={iw} size={24} /> : <span className="dim">–</span>}</span>
                <span className="phase-label">{{ opening: 'Ouverture', middlegame: 'Milieu de jeu', endgame: 'Finale' }[ph]}</span>
                <span className="phase-cell">{ib ? <ClassIcon cls={ib} size={24} /> : <span className="dim">–</span>}</span>
              </div>
            );
          })}
        </div>
        {analysis.opening && (
          <div className="opening-line">
            <ClassIcon cls="book" size={18} />
            <span className="ellipsis">
              <b>{analysis.opening.eco}</b> · {analysis.opening.name}
            </span>
          </div>
        )}
      </div>

      {keyMoves.length > 0 && (
        <>
          <div className="section-title">
            <h2>Moments clés</h2>
          </div>
          <div className="list">
            {keyMoves.slice(0, 8).map((m) => (
              <button key={m.ply} className="card tight pressable key-move" onClick={() => onStart(m.ply + 1)}>
                <ClassIcon cls={m.classification} size={30} />
                <div className="grow" style={{ textAlign: 'left', minWidth: 0 }}>
                  <div className="row" style={{ gap: 6 }}>
                    <span className="dim small num">{moveLabel(m.ply, '').replace(/\s+$/, '')}</span>
                    <San san={m.san} color={m.color} className="km-san" />
                    <span className="km-cls" style={{ color: CLASS_META[m.classification].color }}>
                      {CLASS_META[m.classification].label}
                    </span>
                  </div>
                  <div className="muted small ellipsis">{m.comment}</div>
                </div>
                <ChevronRight size={18} className="dim" />
              </button>
            ))}
          </div>
        </>
      )}

      <div className="sticky-cta">
        <button className="btn primary lg block" onClick={() => onStart(0)}>
          <Play size={20} fill="#fff" /> Commencer la revue
        </button>
      </div>
    </div>
  );
}
