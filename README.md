# ♞ AnalyseChess

Application Android d'**analyse de parties d'échecs** inspirée du « Bilan de partie » de Chess.com. Tout est calculé **sur le téléphone** par Stockfish 19 : vos parties ne sont envoyées à aucun serveur.

## ✨ Fonctionnalités

- **Import automatique** de vos parties **Chess.com** et **Lichess** (il suffit du pseudo), synchronisation au démarrage
- **Import PGN** : coller du texte, choisir un fichier `.pgn` (plusieurs parties à la fois), ou essayer avec des parties légendaires (Kasparov–Topalov, l'Immortelle, la partie de l'Opéra, la partie du siècle)
- **Bilan de partie** comme sur Chess.com :
  - classification de chaque coup : **Brillant !!**, **Très bon coup !**, Meilleur, Excellent, Bon, **Théorique**, Imprécision ?!, Erreur ?, **Occasion manquée**, **Gaffe ??**, Forcé
  - précision de chaque joueur (formule publique de Lichess), graphique d'évaluation interactif, moments clés
  - **Elo estimé de la partie** pour chaque joueur, précision par phase (ouverture, milieu de jeu, finale)
  - commentaires du coach en français (« Cela permet un mat en 3 », « Vous pouviez gagner une tour avec Fxe5 »…)
  - revue coup par coup : barre d'évaluation, flèche du meilleur coup, meilleure suite, **mode exploration** avec Stockfish en direct (3 lignes)
- **Statistiques** : Elo estimé à partir de vos parties analysées, **prédiction à 30 jours**, évolution Elo, **radar de compétences**, **points forts / points faibles** avec conseils, précision par phase, répertoire d'ouvertures (Blancs / Noirs), bilan par cadence
- Thèmes d'échiquier, 3 jeux de pièces, notation figurines / française / anglaise, sons et vibrations

## 📱 Installer l'APK

Chaque `push` sur GitHub déclenche le workflow **Build APK Android** (`.github/workflows/android.yml`) qui :

1. installe les dépendances, lance les tests et construit l'application web ;
2. compile l'APK signé avec Gradle ;
3. le publie dans l'onglet **Actions** (artefact) **et** dans une **Release GitHub**.

➡️ Depuis votre téléphone, ouvrez **Releases → la plus récente** et téléchargez `AnalyseChess-v1.0.X.apk`, puis autorisez l'installation depuis votre navigateur.

Les versions successives sont signées avec la même clé : chaque nouvel APK s'installe par-dessus le précédent sans perdre vos données.

> 🔐 La clé de signature `android/app/analysechess.keystore` est incluse dans le dépôt pour que tout fonctionne sans configuration. Pour publier sur le Play Store, créez votre propre clé et ajoutez-la dans les secrets du dépôt (`ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`) : le workflow l'utilisera automatiquement.

## 🛠️ Développement

```bash
npm install          # copie aussi le moteur Stockfish dans public/engine
npm run dev          # application dans le navigateur (http://localhost:5173)
npm test             # tests unitaires
npm run build        # build de production (dist/)
npx cap sync android # copie le build dans le projet Android
```

Tests d'analyse avec le vrai moteur (plus longs) :

```bash
ANALYSIS=1 npx vitest run src/test/famous.analysis.test.ts
```

### Architecture

| Dossier | Rôle |
| --- | --- |
| `src/lib/engine.ts` | Pilotage UCI de Stockfish 19 (WASM, Web Worker) |
| `src/lib/analysis.ts` | Analyse d'une partie : évaluations, réconciliation, phases, résumé par joueur |
| `src/lib/classify.ts` | Classification des coups (brillant, très bon coup, occasion manquée…) |
| `src/lib/tactics.ts` | Échange statique (SEE), détection de sacrifices, pièces en prise |
| `src/lib/accuracy.ts`, `elo.ts` | Précision (algorithme Lichess), estimation et projection Elo |
| `src/lib/insights.ts` | Statistiques, compétences, points forts / faibles |
| `src/lib/api/` | API publiques Chess.com et Lichess |
| `src/screens/` | Écrans (Accueil, Parties, Import, Bilan, Stats, Réglages) |
| `android/` | Projet Android Capacitor 8 |

## 📄 Licences

- Code de l'application : GPL v3 (Stockfish et stockfish.js sont sous GPL v3)
- Pièces : cburnett (GPL v2+), merida (GPL v2+), chessnut (Apache 2.0)
- Base d'ouvertures : [lichess-org/chess-openings](https://github.com/lichess-org/chess-openings) (CC0)

Application indépendante, non affiliée à Chess.com ni à Lichess.
