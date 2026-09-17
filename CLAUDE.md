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
| `npm run deploy` | publie `dist/` sur la branche `gh-pages` (voir README) |

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
- **vite-plugin-pwa** : service worker, manifeste et précache complet (polices incluses),
  donc jouable hors connexion et installable
- **gh-pages** (dev) : publication sur GitHub Pages
- Sauvegarde : `localStorage` + export/import base64. Aucun backend, aucune dépendance payante.
- **Sons entièrement synthétisés** en Web Audio (`src/ui/sound.ts`) : aucun fichier audio
  à charger ni à précacher, et le jeu reste identique hors ligne. Coupés par défaut.

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
    core.ts      addPizzas / updateUnlocks (partagés par le tick et les actions)
    upgrades.ts  déblocage, achat et lecture des effets des améliorations
    achievements.ts  évaluation des conditions, bonus de collection, drapeaux
    events.ts    pizzas d'or : apparition, expiration, effets temporaires
    prestige.ts  Étoiles, arbre de compétences, resetRun / doPrestige
    challenges.ts règles en vigueur, entrée, sortie et validation des défis
    expansion.ts  couche 2 : Contrats, villes, transcendance
    automation.ts pétrisseur et acheteurs automatiques (arbre de prestige)
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
    upgrades.ts  68 améliorations (cuisine, synergie, clic)
    achievements.ts 82 hauts faits, dont 8 cachés
    events.ts    les quatre pizzas d'or et leurs réglages
    prestige.ts  les 28 nœuds de l'arbre et la formule des Étoiles
    challenges.ts les 8 défis : contrainte, objectif, récompense
    cities.ts    les 6 villes de la couche 2 et leurs effets
    i18n/fr.ts   TOUS les textes affichés
  store/      pont entre le moteur et React
    gameLoop.ts  rAF + accumulateur à pas fixe, autosave, hors ligne, actions exposées
    gameStore.ts store Zustand : instantané publié à 10 fps
  ui/         composants React (CSS Modules à côté de chaque composant)
    icons/       pictogrammes SVG maison
    sound.ts     sons synthétisés (Web Audio), aucun fichier externe
public/       icônes PWA (générées depuis public/icon.svg)
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
8. **`core.ts` existe pour casser un cycle d'imports** : `tick.ts` a besoin des actions
   (automatisation) et les actions ont besoin de `addPizzas` / `updateUnlocks`.
   Ne jamais faire importer `tick.ts` par `actions.ts`.
9. **L'automatisation passe par les mêmes actions que le joueur** (`clickDough`,
   `buyGenerator`, `buyUpgrade`) : aucune règle parallèle, donc aucune divergence possible.
10. **Un seul point d'agrégation des effets permanents** : `permanentEffects()` de
   `engine/prestige.ts`, qui fond ensemble les nœuds de l'arbre ET les récompenses des
   défis. Ne jamais lire une source d'effet directement ailleurs.
11. **Une seule définition de « recommencer une partie »** : `resetRun()`. Le prestige,
   l'entrée et la sortie de défi l'utilisent tous les trois.
12. **Le joueur n'est jamais pénalisé pour son inaction.** Le seul effet négatif du jeu
   (le contrôle d'hygiène) ne s'applique que si le joueur clique dessus, et il est
   visuellement distinct pour qu'il puisse choisir de l'ignorer.

### Boucle de jeu

`requestAnimationFrame` mesure le delta réel ; un accumulateur le découpe en pas **fixes de 50 ms**
(20 ticks/s), donc `tick()` est déterministe. L'UI n'est rafraîchie qu'à **10 fps** (publication d'un
instantané dans le store). Un écart de plus de 5 s (onglet endormi, veille) n'est pas rattrapé tick
par tick : il passe par `offline.applyElapsed()`. Sauvegarde automatique toutes les 30 s, plus au
`beforeunload` et quand l'onglet passe en arrière-plan.

### Équilibrage

Toutes les valeurs vivent dans `src/data/`. Elles sont celles du cahier des charges,
c'est-à-dire le barème de Cookie Clicker : **rythme lent, partie qui se joue sur
plusieurs semaines, choix assumé**. Ce sont les prestiges, pas la première partie,
qui donnent accès au haut du tableau.

`npm run sim` rejoue le moteur sans interface avec une stratégie gloutonne et affiche
le temps de chaque jalon, l'écart au jalon précédent et les murs (> 3× le précédent).
Les repères du doc y sont affichés pour information, sans verdict.

Mesures actuelles (joueur actif, 3 clics/s) :

| Jalon | Mesuré |
|---|---|
| 1re Étoile (prestige possible) | 56 min |
| Robot pizzaïolo débloqué (8e) | 1 h 27 |
| Drone-livreur débloqué (9e) | 3 h 06 |
| Four à plasma (10e) | hors d'atteinte en première partie, comme prévu |

Deux comportements volontaires, qui ne sont pas des bugs :
- les améliorations de cuisine arrivent à 1, 5, 25, 50 et 100 exemplaires, donc sur les
  mêmes nombres que les paliers de production (25, 50, 100) : le joueur encaisse un
  saut ×4 à ces trois seuils, puis un plat plus long ;
- la production ralentit nettement après ~4 h de jeu actif, une fois l'essentiel des
  68 améliorations acheté. C'est le mur que le prestige doit débloquer.

### Prestige — « Recette Secrète »

Étoiles gagnées = `floor(cbrt(pizzas cumulées depuis la dernière transcendance / 1e9))`,
moins celles déjà encaissées. Chaque Étoile **non dépensée** donne +2 % de production
(jusqu'à +5 % avec l'arbre).

- **Remis à zéro** : pizzas, cuisines, améliorations, statistiques de la run, pizzas d'or.
- **Conservé** : hauts faits, drapeaux, statistiques globales, Étoiles, arbre, réglages.
- L'arbre compte **28 nœuds** en 4 branches (fournil, salle, nuit, brigade) pour 481 Étoiles
  au total : il s'ouvre sur plusieurs semaines, c'est voulu.
- Les effets de l'arbre sont agrégés par `permanentEffects()`, avec les récompenses de
  défis et les villes : les multiplicateurs se multiplient, les valeurs (rendement hors
  ligne, plafond, bonus par Étoile) prennent le MEILLEUR — acheter la version supérieure
  remplace la précédente au lieu de s'y ajouter.

Rythme mesuré au simulateur (joueur actif, `--hours 48`) : prestiges à 52 min, 1 h 46,
3 h 15, 6 h 07, 11 h 35, 21 h 48 et 1 j 12 h ; 12 nœuds sur 28 et 10e cuisine achetée
à 16 h 38 de jeu cumulé.

Le simulateur applique la règle du cahier des charges : on prestige quand le gain
**double le total d'Étoiles déjà gagnées** (pas la banque — sinon, comme l'arbre vide
la banque, la règle dégénère en « prestige dès la première Étoile »).

### Défis

Un défi est une partie normale avec une contrainte (`ChallengeRules`) et un objectif
en pizzas produites **pendant la run**. Entrer dans un défi ou en sortir passe par
`resetRun()` : la partie repart de zéro et les Étoiles méritées sont encaissées au
passage, donc essayer un défi ne fait jamais perdre de progression.

- Ils s'ouvrent après **3 prestiges**.
- La récompense est **permanente** : elle survit aux prestiges et aux autres défis,
  et s'agrège dans `permanentEffects()` exactement comme un nœud d'arbre.
- La validation est automatique dès l'objectif atteint ; le joueur sort quand il veut.
- Une contrainte peut offrir une **mise de départ** (`startPizzas`). « Zéro clic » en a
  besoin : sans clic ni pizzas, la première cuisine serait inachetable et le défi
  mathématiquement impossible.

Temps mesurés (`npm run sim -- --challenges`), **sans aucun nœud d'arbre ni récompense**,
donc dans le pire cas possible pour le joueur :

| Défi | Objectif | Terminé en |
|---|---|---|
| Zéro clic | 20 M | 26 min |
| Sans apprenti | 200 M | 36 min |
| Petit joueur | 500 M | 52 min |
| Inflation | 30 M | 1 h 00 |
| Sans livraison | 300 M | 1 h 14 |
| Cuisine froide | 2 M | 1 h 15 |
| Bricolage | 30 M | 1 h 17 |
| Pâte pure | 400 M | 1 h 22 |

### Expansion Mondiale — la couche 2

Contrats = `floor(cbrt(cumul de pizzas de TOUTE la partie / 2e12))`, moins ceux déjà
signés. Transcender efface **toute la couche 1** — pizzas, cuisines, améliorations,
Étoiles et arbre — et conserve hauts faits, défis relevés, villes et statistiques globales.

Les Contrats fondent et agrandissent **6 villes**. Une ville :
- produit en parallèle des cuisines, et **ne repart jamais de zéro** (ni au prestige,
  ni en défi) : c'est elle qui relance chaque nouvelle partie ;
- porte un effet passif proportionnel à son niveau (production des cuisines, pétrissage,
  coût, fréquence des pizzas d'or, hors ligne, production des autres villes) ;
- se fonde dans l'ordre : Naples, Chicago, Tokyo, Paris, São Paulo, Station orbitale.

Les effets qui dégénéreraient sont plafonnés dans `CITY_CAPS` (coûts, fréquence
des événements, rendement hors ligne).

Mesures (joueur actif, `--hours 96 --step 10`) : 1er Contrat mérité à **10 h 09**.
Le simulateur transcende dès qu'il le peut et signe donc 4 Contrats en 4 jours ; un
joueur avisé attend plutôt une poignée de Contrats (~2 jours de jeu actif) avant de
tout effacer, puisque la racine cubique récompense la patience. En rythme idle, cela
place l'ouverture de la couche 2 autour de 2 à 4 jours, comme prévu au cahier des charges.

> Le diviseur valait 1e15 dans la première version : la première transcendance ne
> rapportait alors qu'UN Contrat pour deux jours de jeu effacés. Personne n'aurait
> accepté ce marché.

### Sauvegarde

Clé `pizza-tycoon-save`, champ `version` + table `MIGRATIONS` appliquée en chaîne au chargement.
Une sauvegarde illisible n'est **jamais** écrasée : elle est recopiée dans
`pizza-tycoon-save-corrupted` et le jeu propose au joueur de l'exporter.

## Conventions

- Code et identifiants en **anglais**, commentaires et textes joueur en **français**.
- Imports relatifs avec extension `.ts` / `.tsx` (pas d'alias de chemin).
- Un composant = un fichier `.tsx` + un `.module.css` du même nom.
- Tests dans `tests/`, nommés `<module>.test.ts`, descriptions en français.

## En ligne

Le jeu est déployé sur **https://d44ndy.github.io/pizza-tycoon/** depuis la branche
`gh-pages` (`npm run deploy`). Vérifié en production : chargement sans erreur console,
service worker enregistré sur le bon scope, sauvegarde locale fonctionnelle.

## Feuille de route

| Phase | Contenu | État |
|---|---|---|
| 0 | Choix du thème | ✅ Empire de la Pizza |
| 1 | MVP : moteur, 10 cuisines, achat groupé, paliers, sauvegarde, hors ligne | ✅ |
| 2 | Améliorations, synergies, pizzas d'or, 82 hauts faits, simulateur, direction visuelle | ✅ |
| 3 | Prestige « Recette Secrète » (⭐ Étoiles), arbre de compétences, automatisation | ✅ |
| 4 | 8 défis + récompenses | ✅ |
| 5 | Prestige couche 2 « Expansion Mondiale » (villes), PWA, sons, déploiement GitHub Pages | ✅ |

Le jeu est complet. Pour aller plus loin, les points d'extension restent les mêmes :
- `formulas.globalMultiplier()` : pipeline unique (hauts faits, Étoiles, arbre, défis, villes).
- `permanentEffects()` : agrège arbre, récompenses de défis et effets de villes.
- `state.prestige.layers` : le dictionnaire accepte une couche 3 sans rien casser.
- `data/i18n/fr.ts` : tous les textes sont déjà centralisés pour une traduction.
