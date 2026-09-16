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
| `npm run sim` | simulateur d'équilibrage (options : `--hours`, `--clicks`, `--click-minutes`, `--no-events`, `--seed`) |
| `npm run preview` | sert le build de production |

À faire avant chaque commit : `npm test` **et** `npm run build`.

## Stack

- **Vite 8** + **TypeScript 7** (mode `strict` complet, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`)
- **React 18** + **Zustand 5** (le store ne contient qu'un instantané, aucune logique de jeu)
- **break_eternity.js** pour les nombres au-delà de 1e308
- **Vitest 4** pour les tests du moteur
- **CSS Modules + variables CSS** (pas de Tailwind) : thème clair/sombre et réduction
  d'animations pilotés par des tokens sur `:root[data-theme]`
- **@fontsource/alfa-slab-one** et **@fontsource-variable/archivo** (licence OFL) :
  typographies auto-hébergées, pour que le jeu reste identique hors ligne (PWA en Phase 5)
- Sauvegarde : `localStorage` + export/import base64. Aucun backend, aucune dépendance payante.

## Direction visuelle — « Carton & tampon »

L'interface est imprimée sur une boîte à pizza. Trois règles tiennent tout le style,
et elles ne se négocient pas au cas par cas :

1. **aucun dégradé, aucune ombre floue** — les ombres sont dures et décalées
   (`--shadow: 3px 3px 0`), comme une encre mal calée à l'impression ;
2. **bordures franches de 2 px, angles vifs** (rayon 2 px maximum) ;
3. **chiffres toujours tabulaires** (classe `.num`), pour que les compteurs ne dansent pas.

Typographies : *Alfa Slab One* pour les titres et les valeurs fortes, *Archivo* pour le texte.
Palette : kraft (`--paper`), encre (`--ink`), tomate (`--tom`), basilic (`--bas`).
Le thème sombre est le même carton, la nuit : uniquement des tokens redéfinis.

**Aucun emoji dans l'interface.** Tous les pictogrammes sont dessinés à la main dans
`src/ui/icons/Picto.tsx` (grille 24×24, trait de 1,6 px, `currentColor`) et la pizza
héros dans `PizzaMark.tsx`. Un emoji a l'air posé là et change de dessin d'une
plateforme à l'autre ; ces pictos partagent tous la même épaisseur de trait.

## Architecture

```
src/
  engine/     logique PURE — interdit d'importer React, le DOM ou Date.now() ici
    decimal.ts   enveloppe break_eternity (D, ZERO, ONE…)
    upgrades.ts  déblocage, achat et lecture des effets des améliorations
    achievements.ts  évaluation des conditions, bonus de collection, drapeaux
    events.ts    pizzas d'or : apparition, expiration, effets temporaires
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
    generators.ts les 10 cuisines (coût de base, production de base, picto, texte)
    upgrades.ts  74 améliorations (cuisine, synergie, clic, recettes globales)
    achievements.ts 82 hauts faits, dont 8 cachés
    events.ts    les quatre pizzas d'or et leurs réglages
    i18n/fr.ts   TOUS les textes affichés
  store/      pont entre le moteur et React
    gameLoop.ts  rAF + accumulateur à pas fixe, autosave, hors ligne, actions exposées
    gameStore.ts store Zustand : instantané publié à 10 fps
  ui/         composants React (CSS Modules à côté de chaque composant)
    icons/       pictogrammes SVG maison
sim/          simulateur d'équilibrage headless (npm run sim)
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
7. **Les événements se règlent sur le temps de JEU** (`stats.playTimeTotal`), jamais sur
   l'horloge système : c'est ce qui garde `tick()` déterministe et rejouable par le simulateur.
8. **Le joueur n'est jamais pénalisé pour son inaction.** Le seul effet négatif du jeu
   (le contrôle d'hygiène) ne s'applique que si le joueur clique dessus, et il est
   visuellement distinct pour qu'il puisse choisir de l'ignorer.

### Boucle de jeu

`requestAnimationFrame` mesure le delta réel ; un accumulateur le découpe en pas **fixes de 50 ms**
(20 ticks/s), donc `tick()` est déterministe. L'UI n'est rafraîchie qu'à **10 fps** (publication d'un
instantané dans le store). Un écart de plus de 5 s (onglet endormi, veille) n'est pas rattrapé tick
par tick : il passe par `offline.applyElapsed()`. Sauvegarde automatique toutes les 30 s, plus au
`beforeunload` et quand l'onglet passe en arrière-plan.

### Équilibrage

Toutes les valeurs vivent dans `src/data/`. Elles ont été **mesurées, pas devinées** :
`npm run sim` rejoue le moteur sans interface avec une stratégie gloutonne et affiche
le temps de chaque jalon, l'écart au jalon précédent et les murs (> 3× le précédent).

Cibles et résultats actuels (joueur actif, 3 clics/s) :

| Jalon | Cible | Mesuré |
|---|---|---|
| 1re Étoile (prestige possible) | 30–60 min | 37 min |
| 10e cuisine débloquée | 45–90 min | 1 h 25 |

La table de coûts d'origine (celle de Cookie Clicker) a dû être corrigée : elle faisait
payer 14 à 16 fois le prix de la cuisine précédente pour 5,6 fois sa production, ce qui
rendait les quatre dernières cuisines inatteignables en première partie. Le haut du
tableau est désormais à ~10× le coût pour ~6,5× la production.

La production plafonne vers 3 h 30 de jeu actif, une fois les 74 améliorations achetées :
c'est le mur que la Phase 3 (prestige) doit débloquer.

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
| 2 | Améliorations, synergies, pizzas d'or, 82 hauts faits, simulateur, direction visuelle | ✅ |
| 3 | Prestige « Recette Secrète » (⭐ Étoiles), arbre de compétences, automatisation | à venir |
| 4 | 8 défis + récompenses | à venir |
| 5 | Prestige couche 2 « Expansion Mondiale » (villes), PWA, sons, déploiement GitHub Pages | à venir |

Points d'extension déjà en place pour la suite :
- `formulas.globalMultiplier()` : pipeline unique où brancher les Étoiles et les défis
  (les hauts faits et les recettes globales y sont déjà branchés).
- `state.prestige.layers` : dictionnaire prêt pour N couches (`recipe`, `expansion`).
- `offline.offlineEfficiency()` / `offlineCapSeconds()` : à rendre dépendants de l'arbre en Phase 3.
- `engine/rng.ts` : déjà en place pour les événements aléatoires de la Phase 2.
