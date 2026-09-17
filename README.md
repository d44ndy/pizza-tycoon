# Pizza Tycoon 🍕

Jeu incrémental (idle/clicker) jouable dans le navigateur, en français.
De l'apprenti pizzaïolo dans un garage au four à plasma orbital.

- 10 cuisines, achat groupé, paliers de production
- 68 améliorations : multiplicateurs, synergies, pétrissage
- 82 hauts faits (dont 8 secrets), chacun +1 % de production
- Pizzas d'or : bonus de production, frénésie, pourboire… et un piège
- Prestige **Recette Secrète** : ⭐ Étoiles et arbre de compétences de 28 nœuds
- 8 défis sous contrainte, avec récompenses permanentes
- Prestige couche 2 **Expansion Mondiale** : des villes qui produisent en parallèle
  et ne repartent jamais de zéro
- Progression hors ligne, sauvegarde locale, export/import, thème clair/sombre,
  jouable au clavier comme au doigt, installable (PWA) et jouable hors connexion

Aucun compte, aucun serveur, aucune publicité : tout tient dans le navigateur.

## Développement

```bash
npm install
npm run dev
```

| Commande | Effet |
|---|---|
| `npm run dev` | serveur de développement |
| `npm test` | tests du moteur |
| `npm run build` | vérification TypeScript + build de production |
| `npm run preview` | sert le build de production |
| `npm run sim` | simulateur d'équilibrage (voir `CLAUDE.md`) |
| `npm run deploy` | publie `dist/` sur la branche `gh-pages` |

## Déploiement sur GitHub Pages

Le build utilise des chemins relatifs (`base: './'`), il fonctionne donc aussi bien
à la racine d'un domaine que dans un sous-dossier `https://<compte>.github.io/<dépôt>/`.

1. Créer un dépôt sur GitHub, puis :

```bash
git remote add origin https://github.com/<compte>/<dépôt>.git
git push -u origin main
```

2. Publier :

```bash
npm run deploy
```

3. Dans **Settings → Pages** du dépôt, choisir la branche `gh-pages` (dossier `/`).

Le site est ensuite servi sur `https://<compte>.github.io/<dépôt>/`.
Chaque `npm run deploy` reconstruit et repousse la branche.

## Licence

Code : usage libre. Typographies *Alfa Slab One* et *Archivo* sous licence
[SIL Open Font License 1.1](https://openfontlicense.org/). Aucun univers sous licence,
aucun personnage ni marque existants : tous les visuels sont dessinés pour ce projet.
