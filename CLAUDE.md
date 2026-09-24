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
| `npm run sim` | simulateur d'équilibrage (options : `--hours`, `--step`, `--clicks`, `--click-minutes`, `--no-events`, `--no-chef`, `--challenges`, `--seed`) |
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

**Le décor est vivant, mais il ne bouge pas vraiment.** Une page où seul un compteur
défile a l'air morte ; une page qui glisse en permanence a l'air d'une publicité. D'où
trois règles pour toute animation du jeu :

1. **des images, pas des glissements** : toutes les animations sont en `steps()`, comme un
   tampon qu'on repose — jamais un mouvement lisse ;
2. **tout revient à son point de départ** (dernière image = première), pour que couper les
   animations fige un décor propre au lieu d'une image à moitié sortie de l'écran ;
3. **rien ne doit gêner la lecture** : le décor est soit derrière les panneaux (opaques),
   soit devant mais sous les 10 % d'opacité.

Ce qui vit, et où : la trame du carton dérive de quelques pixels (`styles/tokens.css`),
la farine flotte et les deux tampons respirent (`common/Ambient.tsx`, un seul rendu, mémoïsé),
l'enseigne balance (`App.module.css`), la pizza héros respire et fume dès que quelque chose
produit (`panels/ClickerPanel`), et chaque cuisine possédée s'active à son tour, décalée
par son rang (`panels/GeneratorRow`). L'option « animations réduites » et le réglage système
coupent tout, sans laisser un seul élément de travers.

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
    news.ts      Gazette de la Pâte : dépêches disponibles et choix de la suivante
    chefPizza.ts La Pizza du Chef : évaluation d'une garniture, four et découvertes
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
    achievements.ts 86 hauts faits, dont 8 cachés
    events.ts    les quatre pizzas d'or et leurs réglages
    prestige.ts  les 28 nœuds de l'arbre et la formule des Étoiles
    challenges.ts les 8 défis : contrainte, objectif, récompense
    cities.ts    les 6 villes de la couche 2 et leurs effets
    news.ts      les 51 dépêches de la Gazette et leurs conditions
    toppings.ts  les 9 ingrédients de La Pizza du Chef et leurs règles
    i18n/fr.ts   TOUS les textes affichés
  store/      pont entre le moteur et React
    gameLoop.ts  rAF + accumulateur à pas fixe, autosave, hors ligne, actions exposées
    gameStore.ts store Zustand : instantané publié à 10 fps
  ui/         composants React (CSS Modules à côté de chaque composant)
    icons/       pictogrammes SVG maison
    sound.ts     sons synthétisés (Web Audio), aucun fichier externe
    useKeyboardShortcuts.ts  Espace, 1…0, B, U
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
6. **Un seul formateur de nombres** : `engine/format.ts`, via le hook `useFormat()` — `fmt` pour
   les quantités, `fmtInt` pour les compteurs, `fmtDec` / `fmtMult` pour les décimales et les
   multiplicateurs (« ×1,36 »). Jamais de `toFixed()` dans l'interface : il écrit « 1.36 ».
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
le temps de chaque jalon, l'écart au jalon précédent et les murs (> 3× le précédent),
puis le **rebond de chaque prestige** (voir plus bas). Les repères du doc y sont
affichés pour information, sans verdict.

Le joueur simulé joue comme un humain qui lit l'écran, pas comme un robot :
- il achète ce qui rapporte le plus de production par pizza dépensée ;
- il enfourne la meilleure des trois championnes du chef qu'il connaît, mais attend
  10 min après un prestige (juste après, seul le pétrissage rapporte, et il se
  retrouverait coincé une heure avec la mauvaise pizza) ;
- il dépense ses Étoiles dans le nœud qui rapporte le plus **par Étoile**, jugé sur
  l'économie qu'il va reconstruire, et garde ses Étoiles (+2 % chacune) si aucun nœud
  ne fait mieux ;
- il prestige quand le gain double ses Étoiles **et** que ces Étoiles achètent un nœud
  qui vaut le coup — c'est ce qu'affiche l'aperçu sous « Brûler la recette » ;
- en profil idle (`--click-minutes`), il pétrit au début de CHAQUE partie, sinon il ne
  pourrait jamais racheter son premier apprenti après un prestige.

Mesures actuelles (joueur actif, 3 clics/s, pizzas d'or attrapées) :

| Jalon | Mesuré |
|---|---|
| Première fournée du chef | 14 min |
| 1re Étoile (prestige possible) | 55 min (idle : 1 h 00) |
| Robot pizzaïolo débloqué (8e) | 1 h 19 (2e partie) |
| Drone-livreur débloqué (9e) | 2 h 25 (2e partie) |
| Four à plasma (10e) | 4 h 32, en 4e partie ; hors d'atteinte avant le premier prestige |
| 1er Contrat mérité | 5 h 49 (idle : 6 h 31) |

Deux comportements volontaires, qui ne sont pas des bugs :
- les améliorations de cuisine arrivent à 1, 5, 25, 50 et 100 exemplaires, donc sur les
  mêmes nombres que les paliers de production (25, 50, 100) : le joueur encaisse un
  saut ×4 à ces trois seuils, puis un plat plus long ;
- la production ralentit nettement après ~4 h de jeu actif, une fois l'essentiel des
  68 améliorations acheté. C'est le mur que le prestige doit débloquer.

### Prestige — « Recette Secrète »

Étoiles gagnées = `floor(cbrt(pizzas cumulées depuis la dernière transcendance / 2e9))`,
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

Rythme mesuré au simulateur (joueur actif, `--hours 168 --step 30`) : prestiges à 47 min,
1 h 26, 2 h 35, 8 h 55, 16 h 51, 1 j 1 h et 1 j 11 h ; au bout de 7 jours, **7 nœuds sur 28**,
8 transcendances et 21 niveaux de ville. Le rythme « plusieurs semaines » tient : l'ancien
réglage donnait 6 nœuds et 14 niveaux de ville sur la même semaine.

**Le rebond : un prestige doit se sentir.** Le simulateur mesure, pour chaque prestige,
le temps qu'il faut pour reproduire la run qu'on vient de brûler, rapporté à sa durée.
À 100 %, le prestige n'a rien apporté ; à 50 %, il a divisé le temps par deux. Mesures
sans pizzas d'or (elles ajoutent trop de hasard) :

| Prestige | Avant (carnet ×1,1) | Maintenant (carnet ×2) |
|---|---|---|
| 1er | 62 % | **39 %** |
| 2e | 95 % | 77 % |
| 3e | 98 % | 64 % |

Pour que le premier prestige compte, le carnet (1 Étoile) est passé de ×1,1 à ×2. Pour ne
pas accélérer toute la partie en échange, le diviseur des Étoiles est passé de 1e9 à 2e9 et
celui des Contrats de 2e12 à 2e13 (mesures sur 7 jours ci-dessus). L'écran de prestige
affiche aussi ce que les Étoiles permettraient de s'offrir (`nodesAffordableAfterPrestige`) :
sans cet aperçu, on brûle une heure de partie sans savoir si elle achète quelque chose.

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

Contrats = `floor(cbrt(cumul de pizzas de TOUTE la partie / 2e13))`, moins ceux déjà
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

Mesures : 1er Contrat mérité à **5 h 49** de jeu actif (6 h 31 en idle). Le simulateur
transcende dès qu'il le peut ; un joueur avisé attend plutôt une poignée de Contrats avant
de tout effacer, puisque la racine cubique récompense la patience.

> Le diviseur valait 1e15 dans la première version : la première transcendance ne
> rapportait alors qu'UN Contrat pour deux jours de jeu effacés. Personne n'aurait
> accepté ce marché. Il est passé à 2e12, puis à 2e13 quand le chef et le carnet ×2
> ont accéléré le début de partie (le premier Contrat tombait alors à 2 h 36).

### Confort de jeu

- **Temps avant achat** (`formulas.timeToAfford`) affiché sur chaque cuisine et amélioration
  non abordable ; au-delà de 30 jours, on écrit « hors de portée pour l'instant ».
- **Production par heure** sous le compteur et dans les stats.
- **Automatisation pilotable** : `settings.automation` met en pause chaque automatisme
  débloqué, et le commis ignore les cuisines de `excluded` (interrupteur AUTO sur la ligne).
- **Tout acheter** pour les améliorations (`upgrades.buyAllUpgrades`), les moins chères d'abord.
- **Refaire l'arbre** (`prestige.respecTree`) : rend toutes les Étoiles investies, au prix d'une
  remise à zéro de la partie — sans ce prix, on basculerait vers les nœuds hors ligne avant
  chaque départ, et personne ne devrait se sentir obligé de le faire.
- **Le stock dans le titre de l'onglet** du navigateur (« 148 Md pizzas · Pizza Tycoon »).
- **Les hauts faits simultanés partagent une notification** (« 33 hauts faits ! ») au lieu
  d'empiler une colonne qui masque l'écran ; trois notifications au plus à la fois.
- **Raccourcis** : Espace, 1…0, B, U. Ils se taisent dans un champ de saisie, quand une fenêtre
  de confirmation est ouverte, et ignorent la répétition de touche (pas d'auto-clic déguisé).

### La Pizza du Chef

Un puzzle de garniture, débloqué par la **Pizzeria de quartier**. Huit parts en cercle :
chaque ingrédient a une valeur de base et influence ses **voisines** (i ± 1) ou la part
**d'en face** (i + 4). Les influences s'**additionnent** (`valeur = base × (1 + Σ)`), jamais
elles ne se multiplient — c'est la seule protection contre une combinaison qui s'emballe.

Les trois totaux se convertissent en effets permanents, agrégés comme tout le reste par
`permanentEffects()` : 1 point de production = +0,5 % de production, 1 point de pétrissage
= +0,5 % au clic (`CHEF_PERCENT_PER_POINT`), 2 points de pizzas d'or = 1 % de délai en moins
(plafonné à 50 %). La conversion valait 1 % au départ : la margherita donnait alors +80 %
dès la 14e minute, autant que trois nœuds d'arbre, et le jeu entier allait ~40 % plus vite.

- **Deux garnitures** cohabitent : `draft` (celle qu'on manipule) et `baked` (celle au four,
  la seule qui donne des bonus). Essayer ne coûte donc jamais rien.
- **Le four ne se rallume qu'une heure de JEU** après une fournée. Sans ce délai, on
  referait sa garniture toutes les cinq minutes selon qu'on clique ou qu'on s'absente :
  une corvée d'optimisation, pas un choix.
- **Le four refroidit aussi pendant l'absence** (`offline.coolOven`), sur toute sa durée :
  on recule l'instant de cuisson plutôt que d'avancer le temps de jeu, qui règle aussi
  les pizzas d'or et les statistiques.
- **La pizza au four garnit la pizza héros** (`PizzaMark`, prop `toppings`) : le mini-jeu se
  voit depuis l'écran principal.
- **Quatre hauts faits** : la première fournée, puis les trois records ci-dessous (condition
  `chefBaked`). Les descriptions donnent le score à battre, jamais la garniture.
- **Les ingrédients se découvrent** avec leur cuisine (Pizzeria, Franchise, Usine, Robot)
  et ne se reperdent jamais — ni au prestige, ni à la transcendance. C'est une recette,
  pas un stock.

Les règles ont été **mesurées, pas devinées** : chacune des trois versions a été évaluée
sur les **43 046 721 garnitures possibles** (9⁸). Les deux premières avaient un optimum
unique qui écrasait le reste (la pizza à l'ananas, puis l'alternance piment/champignon).
La version retenue a trois championnes distinctes, une par style de jeu :

| Style | Garniture | Record |
|---|---|---|
| Idle | margherita (tomate/basilic alternés) | 80 production |
| Actif | champignons et oignons, motif `CCNCNNCN` | 160 pétrissage |
| Chasseur de pizzas d'or | hawaïenne (jambon/ananas alternés) | ×2,13 (production × fréquence) |

Ces trois records sont vérifiés par `tests/chef.test.ts` : si une règle bouge, le test tombe.

### La Gazette de la Pâte

Un bandeau de fausses dépêches dont le ton suit l'empire (du voisin qui se plaint jusqu'à la
Lune renommée). 51 dépêches dans `data/news.ts`, **aucune personne ni marque réelle**.
Priorité à l'actualité : une dépêche débloquée pendant la session passe devant les autres ;
celles déjà disponibles au chargement comptent comme vues. Désactivable dans les Options.

### Sauvegarde

Clé `pizza-tycoon-save`, champ `version` (**4**) + table `MIGRATIONS` appliquée en chaîne au chargement.
Une sauvegarde illisible n'est **jamais** écrasée : elle est recopiée dans
`pizza-tycoon-save-corrupted` et le jeu propose au joueur de l'exporter.

### Points connus, à trancher

- **L'économie du clic.** En milieu de partie, un clic vaut surtout un pourcentage de la
  production (améliorations « clickFromProduction », jusqu'à 18 %). Or les multiplicateurs
  de pétrissage — Bras musclés ×3, Cadence ×5, la pizza du pétrisseur, Tokyo, la frénésie
  ×777 — ne multiplient que la petite part fixe du clic (`formulas.clickPower`). Ils
  deviennent presque inutiles passé la première heure. Les appliquer au clic entier
  demande de réduire leurs valeurs (sinon le clic écrase tout) : c'est une décision de
  design, pas un correctif.

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
| 2 | Améliorations, synergies, pizzas d'or, 82 hauts faits (86 aujourd'hui), simulateur, direction visuelle | ✅ |
| 3 | Prestige « Recette Secrète » (⭐ Étoiles), arbre de compétences, automatisation | ✅ |
| 4 | 8 défis + récompenses | ✅ |
| 5 | Prestige couche 2 « Expansion Mondiale » (villes), PWA, sons, déploiement GitHub Pages | ✅ |
| + | Confort de jeu, Gazette de la Pâte, mini-jeu « La Pizza du Chef » | ✅ |

Le jeu est complet. Pour aller plus loin, les points d'extension restent les mêmes :
- `formulas.globalMultiplier()` : pipeline unique (hauts faits, Étoiles, arbre, défis, villes).
- `permanentEffects()` : agrège arbre, récompenses de défis et effets de villes.
- `state.prestige.layers` : le dictionnaire accepte une couche 3 sans rien casser.
- `data/i18n/fr.ts` : tous les textes sont déjà centralisés pour une traduction.
