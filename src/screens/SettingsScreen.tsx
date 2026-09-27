import { ArrowUpRight, Cpu, Grid3x3, Info, MoveUpRight, Palette, Sparkles, Trash2, Vibrate, Volume2, Type } from 'lucide-react';
import type { ReactNode } from 'react';
import { Board } from '../components/Board';
import { Switch } from '../components/ui';
import { clearAll } from '../lib/db';
import type { NotationStyle } from '../lib/notation';
import { BOARD_THEMES, PIECE_SETS, pieceUrl } from '../lib/themes';
import { useApp } from '../store/app';
import { DEPTHS, useSettings, type DepthPreset } from '../store/settings';

function Row({ icon, color, title, sub, right }: { icon: ReactNode; color: string; title: string; sub?: string; right?: ReactNode }) {
  return (
    <div className="setting">
      <div className="s-icon" style={{ background: `${color}22`, color }}>
        {icon}
      </div>
      <div className="grow">
        <div style={{ fontWeight: 600 }}>{title}</div>
        {sub && <div className="dim small">{sub}</div>}
      </div>
      {right}
    </div>
  );
}

export function SettingsScreen() {
  const s = useSettings();
  const { showToast, reloadGames, reloadAccounts, push } = useApp();

  return (
    <div className="screen page-enter">
      <div className="topbar">
        <h1>Réglages</h1>
      </div>

      <div className="card tight" style={{ marginBottom: 18 }}>
        <Board fen="r1bqkb1r/pppp1Qpp/2n2n2/4p3/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 0 4" lastMove={{ from: 'h5', to: 'f7' }} badge={{ square: 'f7', cls: 'best' }} />
      </div>

      <div className="section-title" style={{ marginTop: 0 }}>
        <h2>Échiquier</h2>
      </div>
      <div className="card">
        <div className="row" style={{ marginBottom: 12 }}>
          <Palette size={18} className="dim" /> <b>Couleurs</b>
        </div>
        <div className="theme-grid">
          {BOARD_THEMES.map((t) => (
            <button key={t.id} className={`theme-swatch ${s.boardTheme === t.id ? 'active' : ''}`} onClick={() => s.set({ boardTheme: t.id })}>
              <div className="mini">
                {Array.from({ length: 8 }, (_, i) => (
                  <div key={i} style={{ background: (i + Math.floor(i / 4)) % 2 === 0 ? t.light : t.dark }} />
                ))}
              </div>
              {t.name}
            </button>
          ))}
        </div>
        <div className="row" style={{ margin: '18px 0 12px' }}>
          <Sparkles size={18} className="dim" /> <b>Pièces</b>
        </div>
        <div className="theme-grid">
          {PIECE_SETS.map((p) => (
            <button key={p.id} className={`theme-swatch ${s.pieceSet === p.id ? 'active' : ''}`} onClick={() => s.set({ pieceSet: p.id })}>
              <div className="piece-row">
                <img src={pieceUrl(p.id, 'w', 'n')} alt="" />
                <img src={pieceUrl(p.id, 'b', 'q')} alt="" />
              </div>
              {p.name}
            </button>
          ))}
        </div>
      </div>

      <div className="setting-group" style={{ marginTop: 12 }}>
        <Row icon={<Grid3x3 size={18} />} color="#5b8bd4" title="Coordonnées" right={<Switch on={s.showCoords} onChange={(v) => s.set({ showCoords: v })} />} />
        <Row icon={<MoveUpRight size={18} />} color="#81b64c" title="Flèche du meilleur coup" sub="Affichée après une imprécision" right={<Switch on={s.showArrows} onChange={(v) => s.set({ showArrows: v })} />} />
        <Row
          icon={<Type size={18} />}
          color="#c46bd8"
          title="Notation"
          right={
            <div className="segmented" style={{ width: 170 }}>
              {([
                ['figurine', '♞'],
                ['fr', 'FR'],
                ['en', 'EN'],
              ] as [NotationStyle, string][]).map(([k, l]) => (
                <button key={k} className={s.notation === k ? 'active' : ''} style={{ height: 30 }} onClick={() => s.set({ notation: k })}>
                  {l}
                </button>
              ))}
            </div>
          }
        />
      </div>

      <div className="section-title">
        <h2>Analyse</h2>
      </div>
      <div className="card">
        <div className="row" style={{ marginBottom: 12 }}>
          <Cpu size={18} className="dim" /> <b>Profondeur de Stockfish</b>
        </div>
        <div className="col" style={{ gap: 8 }}>
          {(Object.entries(DEPTHS) as [DepthPreset, (typeof DEPTHS)[DepthPreset]][]).map(([k, d]) => (
            <button key={k} className={`theme-swatch ${s.depthPreset === k ? 'active' : ''}`} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', textAlign: 'left' }} onClick={() => s.set({ depthPreset: k })}>
              <div className="grow">
                <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>{d.label}</div>
                <div className="dim small">
                  Profondeur {d.depth} · {d.hint}
                </div>
              </div>
              <span className={`radio ${s.depthPreset === k ? 'on' : ''}`} />
            </button>
          ))}
        </div>
      </div>
      <div className="setting-group" style={{ marginTop: 12 }}>
        <Row icon={<Sparkles size={18} />} color="#26c2a3" title="Analyse automatique" sub="Analyser dès l’ouverture d’une partie" right={<Switch on={s.autoAnalyze} onChange={(v) => s.set({ autoAnalyze: v })} />} />
        <Row icon={<Volume2 size={18} />} color="#f5c04a" title="Sons" right={<Switch on={s.sounds} onChange={(v) => s.set({ sounds: v })} />} />
        <Row icon={<Vibrate size={18} />} color="#e8844a" title="Vibrations" right={<Switch on={s.haptics} onChange={(v) => s.set({ haptics: v })} />} />
      </div>

      <div className="section-title">
        <h2>Données</h2>
      </div>
      <div className="setting-group">
        <button style={{ width: '100%', textAlign: 'left' }} onClick={() => push({ name: 'about' })}>
          <Row icon={<Info size={18} />} color="#9aa3b4" title="À propos & licences" right={<ArrowUpRight size={18} className="dim" />} />
        </button>
        <button
          style={{ width: '100%', textAlign: 'left' }}
          onClick={async () => {
            if (!confirm('Supprimer toutes les parties, analyses et comptes liés ?')) return;
            await clearAll();
            await Promise.all([reloadGames(), reloadAccounts()]);
            showToast('Toutes les données ont été supprimées');
          }}
        >
          <Row icon={<Trash2 size={18} />} color="#fa5b4b" title="Tout effacer" sub="Parties, analyses et comptes" />
        </button>
      </div>
      <p className="dim tiny" style={{ textAlign: 'center', marginTop: 20 }}>
        AnalyseChess 1.0 · Moteur Stockfish 19 (WASM)
      </p>
    </div>
  );
}

export function AboutScreen() {
  const pop = useApp((s) => s.pop);
  return (
    <div className="screen full page-enter">
      <div className="topbar">
        <button className="icon-btn" onClick={pop}>
          <ArrowUpRight size={20} style={{ transform: 'rotate(-135deg)' }} />
        </button>
        <h1>À propos</h1>
      </div>
      <div className="card col" style={{ gap: 14, lineHeight: 1.55 }}>
        <div className="row">
          <div className="brand-logo">
            <img src="pieces/cburnett/wN.svg" alt="" />
          </div>
          <div>
            <div className="brand-name">
              Analyse<span>Chess</span>
            </div>
            <div className="dim small">Analyse de parties d’échecs</div>
          </div>
        </div>
        <p className="muted small" style={{ margin: 0 }}>
          L’analyse est réalisée entièrement sur votre téléphone par le moteur Stockfish, sans envoyer vos parties sur un serveur. Les classifications (brillant, très bon coup, imprécision, gaffe…) s’inspirent du « Bilan de partie » de Chess.com ; la précision utilise la formule publique de Lichess.
        </p>
        <div className="small">
          <b>Crédits & licences</b>
          <ul className="muted" style={{ paddingLeft: 18, margin: '6px 0 0' }}>
            <li>Stockfish (GPL v3) — stockfishchess.org, portage WASM stockfish.js (GPL v3)</li>
            <li>chess.js (BSD-2)</li>
            <li>Pièces « cburnett » (Colin M.L. Burnett, GPL v2+), « merida » (GPL v2+), « chessnut » (Apache 2.0)</li>
            <li>Base d’ouvertures lichess-org/chess-openings (CC0)</li>
            <li>API publiques de Chess.com et de Lichess</li>
          </ul>
        </div>
        <p className="dim tiny" style={{ margin: 0 }}>
          Application indépendante, non affiliée à Chess.com ni à Lichess. Code source sous licence GPL v3.
        </p>
      </div>
    </div>
  );
}
