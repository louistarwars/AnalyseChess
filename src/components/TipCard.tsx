import { Lightbulb } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useIsManga } from '../lib/theme';
import { CoachMascot } from './manga';

const TIPS = [
  'Avant chaque coup, vérifiez les échecs, les prises et les menaces de l’adversaire.',
  'Un cavalier au bord de l’échiquier contrôle deux fois moins de cases qu’au centre.',
  'En finale, le roi devient une pièce d’attaque : centralisez-le !',
  'Les tours adorent les colonnes ouvertes et la 7e rangée.',
  'Ne sortez pas votre dame trop tôt : elle deviendra une cible.',
  'Roquez tôt pour mettre votre roi à l’abri et connecter vos tours.',
  'Une pièce non défendue est souvent une pièce perdue : repérez-les.',
  'Échangez quand vous avez l’avantage matériel, évitez-le quand vous êtes en retard.',
  'Le fou et le cavalier valent environ 3 pions, la tour 5, la dame 9.',
  'Contrôlez le centre avec vos pions dès l’ouverture.',
];

/** Conseil d'échecs affiché pendant l'analyse. */
export function TipCard() {
  const manga = useIsManga();
  const [i, setI] = useState(() => Math.floor(Math.random() * TIPS.length));
  useEffect(() => {
    const t = setInterval(() => setI((x) => (x + 1) % TIPS.length), 7000);
    return () => clearInterval(t);
  }, []);
  if (manga) {
    return (
      <div className="card tip-card rise" style={{ marginTop: 18 }}>
        <div className="manga-coach-row">
          <CoachMascot mood="think" size={54} />
          <div className="speech" key={i}>
            <div className="coach-name">Le saviez-vous ?</div>
            <div className="cc-text fade-in">{TIPS[i]}</div>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="card tip-card rise" style={{ marginTop: 14 }}>
      <div className="row" style={{ alignItems: 'flex-start' }}>
        <Lightbulb size={20} color="var(--gold)" style={{ flexShrink: 0, marginTop: 2 }} />
        <div>
          <div style={{ fontWeight: 700, marginBottom: 2 }}>Le saviez-vous ?</div>
          <div className="muted small fade-in" key={i}>
            {TIPS[i]}
          </div>
        </div>
      </div>
    </div>
  );
}
