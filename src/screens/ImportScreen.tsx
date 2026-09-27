import { ClipboardPaste, FileUp, Link2, Trash2, User } from 'lucide-react';
import { useRef, useState } from 'react';
import { AccountCard } from './HomeScreen';
import { PlatformLogo } from '../components/ui';
import { networkErrorMessage } from '../lib/api/http';
import { deleteAccount } from '../lib/db';
import { importPgnText, linkAccount } from '../lib/importer';
import { readClipboard } from '../lib/native';
import { useApp } from '../store/app';

const COUNTS = [50, 100, 200, 500];

function AccountLinker({ platform }: { platform: 'chesscom' | 'lichess' }) {
  const { accounts, sync, reloadAccounts, reloadGames, showToast, syncing, setTab } = useApp();
  const [username, setUsername] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [count, setCount] = useState(100);
  const linked = accounts.filter((a) => a.platform === platform);
  const label = platform === 'chesscom' ? 'Chess.com' : 'Lichess';

  const link = async () => {
    if (!username.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const acc = await linkAccount(platform, username);
      await reloadAccounts();
      setUsername('');
      showToast(`Compte ${acc.username} lié !`, 'success');
      await sync(acc, { maxGames: count, full: true });
      setTab('home');
    } catch (e) {
      setError(networkErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page-enter">
      {linked.map((acc) => (
        <div key={acc.key} style={{ marginTop: 14 }}>
          <AccountCard acc={acc} single />
          <div className="row" style={{ marginTop: 8 }}>
            <button className="btn secondary sm grow" disabled={!!syncing[acc.key]} onClick={() => sync(acc, { maxGames: count, full: true })}>
              Réimporter les {count} dernières parties
            </button>
            <button
              className="btn danger sm"
              onClick={async () => {
                if (!confirm(`Retirer le compte ${acc.username} et ses parties importées ?`)) return;
                await deleteAccount(acc.key, true);
                await Promise.all([reloadAccounts(), reloadGames()]);
                showToast('Compte retiré');
              }}
            >
              <Trash2 size={15} />
            </button>
          </div>
        </div>
      ))}

      <div className="card import-card">
        <div className="import-head">
          <PlatformLogo platform={platform} size={46} />
          <div>
            <h3>{linked.length ? 'Ajouter un autre compte' : `Lier votre compte ${label}`}</h3>
            <div className="muted small">Vos parties publiques seront importées automatiquement.</div>
          </div>
        </div>
        <div className="field">
          <User size={18} className="dim" />
          <input
            placeholder={`Pseudo ${label}`}
            value={username}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            onChange={(e) => setUsername(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && link()}
          />
        </div>
        <div className="small dim" style={{ marginTop: 12 }}>
          Nombre de parties à importer
        </div>
        <div className="count-select">
          {COUNTS.map((c) => (
            <button key={c} className={count === c ? 'active' : ''} onClick={() => setCount(c)}>
              {c}
            </button>
          ))}
        </div>
        {error && (
          <div className="small" style={{ color: '#ff8c80', marginTop: 12 }}>
            {error}
          </div>
        )}
        <button className="btn primary block lg" style={{ marginTop: 16 }} disabled={busy || !username.trim()} onClick={link}>
          {busy ? <div className="spinner" /> : <Link2 size={19} />}
          {busy ? 'Connexion…' : 'Lier le compte'}
        </button>
      </div>
    </div>
  );
}

function PgnImporter() {
  const { accounts, reloadGames, showToast, push } = useApp();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const doImport = async (content: string) => {
    if (!content.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const { games, added, errors } = await importPgnText(
        content,
        accounts.map((a) => a.username),
      );
      await reloadGames();
      if (!games.length) {
        setError(errors[0] ?? 'Aucune partie valide trouvée');
        return;
      }
      setText('');
      showToast(`${games.length} partie${games.length > 1 ? 's' : ''} importée${games.length > 1 ? 's' : ''}${added < games.length ? ` (${games.length - added} déjà présente${games.length - added > 1 ? 's' : ''})` : ''}`, 'success');
      if (games.length === 1) push({ name: 'review', gameId: games[0].id });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page-enter">
      <div className="card import-card">
        <div className="import-head">
          <PlatformLogo platform="pgn" size={46} />
          <div>
            <h3>Importer un PGN</h3>
            <div className="muted small">Collez une ou plusieurs parties, ou choisissez un fichier .pgn</div>
          </div>
        </div>
        <textarea
          className="textarea"
          placeholder={'[Event "Partie amicale"]\n[White "Moi"]\n[Black "Adversaire"]\n\n1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 …'}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        {error && (
          <div className="small" style={{ color: '#ff8c80', marginTop: 10 }}>
            {error}
          </div>
        )}
        <div className="row" style={{ marginTop: 12 }}>
          <button
            className="btn secondary grow"
            onClick={async () => {
              const t = await readClipboard();
              if (t) setText(t);
              else showToast('Presse-papiers vide ou inaccessible : collez manuellement', 'error');
            }}
          >
            <ClipboardPaste size={18} /> Coller
          </button>
          <button className="btn primary grow" disabled={busy || !text.trim()} onClick={() => doImport(text)}>
            {busy ? <div className="spinner" /> : 'Importer'}
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          style={{ display: 'none' }}
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            const content = await f.text();
            e.target.value = '';
            await doImport(content);
          }}
        />
        <button className="file-drop" style={{ width: '100%', marginTop: 12 }} onClick={() => fileRef.current?.click()}>
          <FileUp size={20} /> Choisir un fichier .pgn
        </button>
      </div>
      <p className="dim small" style={{ margin: '14px 4px' }}>
        Astuce : sur Chess.com ou Lichess, ouvrez une partie puis « Partager » → « PGN » pour la copier.
      </p>
    </div>
  );
}

export function ImportScreen() {
  const { importTab } = useApp();
  const [tab, setTabLocal] = useState<'chesscom' | 'lichess' | 'pgn'>(importTab ?? 'chesscom');
  return (
    <div className="screen page-enter">
      <div className="topbar">
        <h1 data-kana="インポート">Importer</h1>
      </div>
      <div className="segmented">
        <button className={tab === 'chesscom' ? 'active' : ''} onClick={() => setTabLocal('chesscom')}>
          <PlatformLogo platform="chesscom" size={18} /> Chess.com
        </button>
        <button className={tab === 'lichess' ? 'active' : ''} onClick={() => setTabLocal('lichess')}>
          <PlatformLogo platform="lichess" size={18} /> Lichess
        </button>
        <button className={tab === 'pgn' ? 'active' : ''} onClick={() => setTabLocal('pgn')}>
          <FileUp size={16} /> PGN
        </button>
      </div>
      {tab === 'pgn' ? <PgnImporter key="pgn" /> : <AccountLinker key={tab} platform={tab} />}
    </div>
  );
}
