# Pizza Tycoon 🍕 — guide du dépôt

Jeu incrémental (idle/clicker) jouable dans le navigateur, en français.
Thème : de l'apprenti pizzaïolo dans un garage au four à plasma orbital.

## Commandes

| Commande | Effet |
|---|---|
| `npm run dev` | serveur de développement Vite (http://localhost:5173) |
| `npm test` | tests Vitest (une passe) |
| `npm run test:watch` | tests en mode surveillance |
| `npm run typecheck` | vérification TypeScript seule |
| `npm run build` | typecheck + build de production dans `dist/` |
| `npm run preview` | sert le build de production |

À faire avant chaque commit : `npm test` **et** `npm run build`.

## Stack

- **Vite 8** + **TypeScript 7** (mode `strict` complet, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`)
- **React 18** + **Zustand 5** (le store ne contient qu'un instantané, aucune logique de jeu)
- **break_eternity.js** pour les nombres au-delà de 1e308
- **Vitest 4** pour les tests du moteur
- **CSS Modules + variables CSS** (pas de Tailwind) : thème sombre/clair et réduction
  d'animations pilotés par des tokens sur `:root[data-theme]`
- Sauvegarde : `localStorage` + export/import base64. Aucun backend, aucune dépendance payante.

## Architecture

```
src/
  engine/     logique PURE — interdit d'importer React, le DOM ou Date.now() ici
    decimal.ts   enveloppe break_eternity (D, ZERO, ONE…)
    format.ts    format() : standard / scientifique / ingénieur (+ formatInt, formatTime)
    rng.ts       RNG déterministe seedé (mulberry32), graine stockée dans l'état
    state.ts     GameState + createInitialState()
    formulas.ts  coûts, achat groupé, paliers, production, multiplicateurs
    tick.ts      tick(state, dt) -> state, runFor() pour tests et simulateur
    actions.ts   clickDough, buyGenerator, updateSettings, setTab…
    save.ts      sérialisation, migrations versionnées, localStorage, base64
    offline.ts   applyElapsed / applyOffline (plafond, rendement, anti-triche horloge)
  data/       contenu et équilibrage
    config.ts    TOUTES les constantes d'équilibrage (croissance 1,15, paliers, plafonds…)
    generators.ts les 10 cuisines (coût de base, production de base, emoji, texte)
    i18n/fr.ts   TOUS les textes affichés
  store/      pont entre le moteur et React
    gameLoop.ts  rAF + accumulateur à pas fixe, autosave, hors ligne, actions exposées
    gameStore.ts store Zustand : instantané publié à 10 fps
  ui/         composants React (CSS Modules à côté de chaque composant)
tests/        tests Vitest du moteur
```

### Règles non négociables

1. **`src/engine/` reste pur** : pas d'import React/DOM, pas de `Date.now()` ni de `Math.random()`
   (le temps et l'aléatoire sont passés en paramètres). C'est ce qui rend le moteur testable
   et rejouable par le simulateur d'équilibrage.
2. **Immutabilité** : `tick()` et les actions renvoient un nouvel état avec partage structurel.
   On ne mute jamais l'état reçu.
3. **`Decimal` est immuable** : chaque opération renvoie une nouvelle valeur.
   Pour les puissances, préférer `powFast()` de `formulas.ts` (`Decimal.pow` passe par exp/log
   et renvoie 7,999… pour 2³).
4. **Aucune chaîne visible en dur** dans un composant : tout passe par `data/i18n/fr.ts`.
5. **Aucune constante d'équilibrage en dur** : tout passe par `data/config.ts`.
6. **Un seul formateur de nombres** : `format()` de `engine/format.ts`, via le hook `useFormat()`.

### Boucle de jeu

`requestAnimationFrame` mesure le delta réel ; un accumulateur le découpe en pas **fixes de 50 ms**
(20 ticks/s), donc `tick()` est déterministe. L'UI n'est rafraîchie qu'à **10 fps** (publication d'un
instantané dans le store). Un écart de plus de 5 s (onglet endormi, veille) n'est pas rattrapé tick
par tick : il passe par `offline.applyElapsed()`. Sauvegarde automatique toutes les 30 s, plus au
`beforeunload` et quand l'onglet passe en arrière-plan.

### Sauvegarde

Clé `pizza-tycoon-save`, champ `version` + table `MIGRATIONS` appliquée en chaîne au chargement.
Une sauvegarde illisible n'est **jamais** écrasée : elle est recopiée dans
`pizza-tycoon-save-corrupted` et le jeu propose au joueur de l'exporter.

## Conventions

- Code et identifiants en **anglais**, commentaires et textes joueur en **français**.
- Imports relatifs avec extension `.ts` / `.tsx` (pas d'alias de chemin).
- Un composant = un fichier `.tsx` + un `.module.css` du même nom.
- Tests dans `tests/`, nommés `<module>.test.ts`, descriptions en français.

## Feuille de route

| Phase | Contenu | État |
|---|---|---|
| 0 | Choix du thème | ✅ Empire de la Pizza |
| 1 | MVP : moteur, 10 cuisines, achat groupé, paliers, sauvegarde, hors ligne | ✅ |
| 2 | Upgrades, synergies, événements aléatoires, 80+ succès, stats, simulateur `npm run sim` | à venir |
| 3 | Prestige « Recette Secrète » (⭐ Étoiles), arbre de compétences, automatisation | à venir |
| 4 | 8 défis + récompenses | à venir |
| 5 | Prestige couche 2 « Expansion Mondiale » (villes), PWA, sons, déploiement GitHub Pages | à venir |

Points d'extension déjà en place pour la suite :
- `formulas.globalMultiplier()` : pipeline unique où brancher succès, Étoiles et défis.
- `state.prestige.layers` : dictionnaire prêt pour N couches (`recipe`, `expansion`).
- `offline.offlineEfficiency()` / `offlineCapSeconds()` : à rendre dépendants de l'arbre en Phase 3.
- `engine/rng.ts` : déjà en place pour les événements aléatoires de la Phase 2.
