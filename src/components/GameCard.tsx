import { Star, Zap, Timer, Hourglass, CalendarDays, Rabbit } from 'lucide-react';
import { resultForColor } from '../lib/importer';
import type { StoredGame, TimeClass } from '../lib/types';
import { useApp } from '../store/app';
import { Hanko } from './manga';
import { accuracyColor, formatDate, PlatformLogo, timeClassLabel } from './ui';

export function TimeClassIcon({ tc, size = 14 }: { tc: TimeClass; size?: number }) {
  switch (tc) {
    case 'bullet':
      return <Rabbit size={size} />;
    case 'blitz':
      return <Zap size={size} />;
    case 'rapid':
      return <Timer size={size} />;
    case 'classical':
      return <Hourglass size={size} />;
    case 'daily':
      return <CalendarDays size={size} />;
    default:
      return <Timer size={size} />;
  }
}

export function GameCard({ game, index = 0 }: { game: StoredGame; index?: number }) {
  const push = useApp((s) => s.push);
  const analyzing = useApp((s) => s.current?.gameId === game.id);
  const progress = useApp((s) => (s.current?.gameId === game.id ? s.current.progress : undefined));
  const queued = useApp((s) => s.queue.includes(game.id));
  const me = game.userColor;
  const res = me ? resultForColor(game.result, me) : undefined;
  const oppColor = me === 'w' ? 'b' : 'w';
  const opp = me ? (oppColor === 'w' ? game.white : game.black) : undefined;
  const oppElo = me ? (oppColor === 'w' ? game.whiteElo : game.blackElo) : undefined;
  const myAcc = me && game.summary ? game.summary[me === 'w' ? 'white' : 'black'].accuracy : undefined;
  const oppAcc = me && game.summary ? game.summary[me === 'w' ? 'black' : 'white'].accuracy : undefined;
  const resLabel = res === 'win' ? 'Victoire' : res === 'loss' ? 'Défaite' : res === 'draw' ? 'Nulle' : game.result.replace('1/2-1/2', '½-½');
  const pct = progress ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <button
      className={`game-card card tight pressable rise ${res ?? ''}`}
      style={{ animationDelay: `${Math.min(index, 10) * 35}ms` }}
      onClick={() => push({ name: 'review', gameId: game.id })}
    >
      <div className="gc-stripe" />
      <div className="gc-main">
        <div className="row" style={{ gap: 8 }}>
          <PlatformLogo platform={game.source} size={18} />
          {me ? (
            <span className="gc-title ellipsis">
              <span className="dim">vs</span> {opp} {oppElo ? <span className="dim gc-elo">({oppElo})</span> : null}
            </span>
          ) : (
            <span className="gc-title ellipsis">
              {game.white} <span className="dim">–</span> {game.black}
            </span>
          )}
          {game.favorite && <Star size={14} fill="#f5c04a" color="#f5c04a" />}
        </div>
        <div className="gc-meta">
          <span className="row" style={{ gap: 4 }}>
            <TimeClassIcon tc={game.timeClass} size={13} /> {timeClassLabel(game.timeClass)}
          </span>
          <span>·</span>
          <span>{formatDate(game.timestamp)}</span>
          <span>·</span>
          <span>{Math.ceil(game.plies / 2)} coups</span>
        </div>
        {game.opening && <div className="gc-opening ellipsis">{game.opening}</div>}
      </div>
      <div className="gc-side">
        <span className={`pill ${res ?? ''}`}>{resLabel}</span>
        {res && <Hanko result={res} />}
        {analyzing ? (
          <span className="gc-analyzing">
            <span className="spinner" style={{ width: 13, height: 13, borderWidth: 2 }} /> {pct}%
          </span>
        ) : queued ? (
          <span className="gc-analyzing dim">En attente</span>
        ) : myAcc !== undefined ? (
          <span className="gc-acc num">
            <b style={{ color: accuracyColor(myAcc) }}>{myAcc.toFixed(1).replace('.', ',')}</b>
            <span className="dim"> / {oppAcc!.toFixed(1).replace('.', ',')}</span>
          </span>
        ) : game.summary ? (
          <span className="gc-acc num">
            <b>{game.summary.white.accuracy.toFixed(0)}</b>
            <span className="dim"> / {game.summary.black.accuracy.toFixed(0)}</span>
          </span>
        ) : (
          <span className="gc-todo">Analyser</span>
        )}
      </div>
    </button>
  );
}
