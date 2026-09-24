/**
 * Prestige couche 1 — « Recette Secrète ».
 *
 * Le joueur brûle son empire et repart de zéro avec une meilleure recette :
 * il conserve ses hauts faits, ses statistiques globales, ses ⭐ Étoiles et son arbre.
 *
 * L'arbre est de la DONNÉE, comme les améliorations : chaque nœud décrit un coût,
 * des prérequis et un effet interprété par `engine/prestige.ts`.
 */
import type { GeneratorId } from './generators.ts';

/**
 * Étoiles gagnées = racine cubique du cumul de pizzas divisé par ce diviseur.
 * 1e9 à l'origine ; 2e9 depuis que La Pizza du Chef accélère le début de partie :
 * la première Étoile retombe vers 47 min de jeu actif, au lieu de 27.
 */
export const STAR_DIVISOR = 2e9;

/** Bonus de production par Étoile NON dépensée (améliorable dans l'arbre). */
export const STAR_BASE_BONUS = 0.02;

export type PrestigeBranch = 'racine' | 'fournil' | 'salle' | 'nuit' | 'brigade';

export type PrestigeEffect =
  /** Multiplie toute la production. */
  | { readonly type: 'globalMult'; readonly factor: number }
  /** Multiplie la valeur du pétrissage. */
  | { readonly type: 'clickMult'; readonly factor: number }
  /** Multiplie le coût des cuisines (0,95 = 5 % moins cher). */
  | { readonly type: 'generatorCost'; readonly factor: number }
  /** Multiplie le coût des améliorations. */
  | { readonly type: 'upgradeCost'; readonly factor: number }
  /** Remplace le bonus par Étoile non dépensée. */
  | { readonly type: 'starBonus'; readonly perStar: number }
  /** Rendement hors ligne, en valeur absolue (0 à 1). */
  | { readonly type: 'offlineEfficiency'; readonly value: number }
  /** Plafond hors ligne, en heures. */
  | { readonly type: 'offlineCap'; readonly hours: number }
  /** Multiplie le délai entre deux pizzas d'or (0,8 = 20 % plus fréquentes). */
  | { readonly type: 'eventFrequency'; readonly factor: number }
  /** Multiplie la durée des effets des pizzas d'or. */
  | { readonly type: 'eventDuration'; readonly factor: number }
  /** Durée de production offerte par le pourboire du siècle, en secondes. */
  | { readonly type: 'jackpotSeconds'; readonly value: number }
  /** Cuisines offertes au début de chaque nouvelle partie. */
  | { readonly type: 'startGenerators'; readonly id: GeneratorId; readonly count: number }
  /** Pizzas offertes au début de chaque nouvelle partie. */
  | { readonly type: 'startPizzas'; readonly amount: number }
  /** Pétrissage automatique, en clics par seconde. */
  | { readonly type: 'autoClick'; readonly perSecond: number }
  /** Achat automatique de la cuisine la plus rentable. */
  | { readonly type: 'autoBuyGenerators' }
  /** Achat automatique des améliorations abordables. */
  | { readonly type: 'autoBuyUpgrades' };

export type PrestigeNodeDef = {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  /** Coût en Étoiles. */
  readonly cost: number;
  readonly branch: PrestigeBranch;
  /** Nœuds à posséder avant de pouvoir acheter celui-ci. */
  readonly requires: readonly string[];
  readonly effect: PrestigeEffect;
};

export const PRESTIGE_BRANCHES: Record<PrestigeBranch, { name: string; description: string }> = {
  racine: { name: 'Le carnet', description: 'Tout commence là' },
  fournil: { name: 'Le fournil', description: 'Produire plus, payer moins' },
  salle: { name: 'La salle', description: 'Pétrissage et pizzas d’or' },
  nuit: { name: 'La nuit', description: 'Ce qui se passe pendant ton absence' },
  brigade: { name: 'La brigade', description: 'Se faire remplacer' },
};

export const PRESTIGE_TREE: readonly PrestigeNodeDef[] = [
  {
    id: 'carnet', name: 'Le carnet du chef', description: 'Toute la production ×2',
    // ×1,1 à l'origine : le premier prestige coûtait une heure de partie pour 10 %, et il
    // fallait 62 % du temps de la run brûlée pour la reproduire. À ×2, il en faut 39 %.
    cost: 1, branch: 'racine', requires: [], effect: { type: 'globalMult', factor: 2 },
  },

  /* --- Le fournil : production et coûts --- */
  {
    id: 'pate-mere', name: 'Pâte mère', description: 'Toute la production ×1,25',
    cost: 2, branch: 'fournil', requires: ['carnet'], effect: { type: 'globalMult', factor: 1.25 },
  },
  {
    id: 'deuxieme-fournee', name: 'Deuxième fournée', description: 'Toute la production ×1,5',
    cost: 6, branch: 'fournil', requires: ['pate-mere'], effect: { type: 'globalMult', factor: 1.5 },
  },
  {
    id: 'fournil-agrandi', name: 'Fournil agrandi', description: 'Toute la production ×2',
    cost: 15, branch: 'fournil', requires: ['deuxieme-fournee'], effect: { type: 'globalMult', factor: 2 },
  },
  {
    id: 'recette-maitresse', name: 'Recette maîtresse', description: 'Toute la production ×3',
    cost: 40, branch: 'fournil', requires: ['fournil-agrandi'], effect: { type: 'globalMult', factor: 3 },
  },
  {
    id: 'achats-groupes', name: 'Achats groupés', description: 'Les cuisines coûtent 5 % de moins',
    cost: 8, branch: 'fournil', requires: ['pate-mere'], effect: { type: 'generatorCost', factor: 0.95 },
  },
  {
    id: 'negociation', name: 'Négociation serrée', description: 'Les cuisines coûtent encore 7 % de moins',
    cost: 25, branch: 'fournil', requires: ['achats-groupes'], effect: { type: 'generatorCost', factor: 0.93 },
  },
  {
    id: 'etoile-montante', name: 'Étoile montante', description: 'Chaque Étoile non dépensée donne +3 % au lieu de +2 %',
    cost: 12, branch: 'fournil', requires: ['deuxieme-fournee'], effect: { type: 'starBonus', perStar: 0.03 },
  },
  {
    id: 'constellation', name: 'Constellation', description: 'Chaque Étoile non dépensée donne +5 %',
    cost: 60, branch: 'fournil', requires: ['etoile-montante'], effect: { type: 'starBonus', perStar: 0.05 },
  },

  /* --- La salle : pétrissage et pizzas d'or --- */
  {
    id: 'bras-muscles', name: 'Bras musclés', description: 'Le pétrissage rapporte 3 fois plus',
    cost: 2, branch: 'salle', requires: ['carnet'], effect: { type: 'clickMult', factor: 3 },
  },
  {
    id: 'cadence', name: 'Cadence infernale', description: 'Le pétrissage rapporte 5 fois plus',
    cost: 10, branch: 'salle', requires: ['bras-muscles'], effect: { type: 'clickMult', factor: 5 },
  },
  {
    id: 'bouche-a-oreille', name: 'Bouche à oreille', description: 'Les pizzas d’or arrivent 20 % plus vite',
    cost: 4, branch: 'salle', requires: ['carnet'], effect: { type: 'eventFrequency', factor: 0.8 },
  },
  {
    id: 'reputation', name: 'Réputation', description: 'Les pizzas d’or arrivent encore 25 % plus vite',
    cost: 14, branch: 'salle', requires: ['bouche-a-oreille'], effect: { type: 'eventFrequency', factor: 0.75 },
  },
  {
    id: 'effets-prolonges', name: 'Effets prolongés', description: 'Les effets des pizzas d’or durent 50 % plus longtemps',
    cost: 18, branch: 'salle', requires: ['bouche-a-oreille'], effect: { type: 'eventDuration', factor: 1.5 },
  },
  {
    id: 'pourboires', name: 'Pourboires généreux', description: 'Le pourboire du siècle vaut 30 minutes de production',
    cost: 22, branch: 'salle', requires: ['reputation'], effect: { type: 'jackpotSeconds', value: 30 * 60 },
  },

  /* --- La nuit : progression hors ligne --- */
  {
    id: 'pate-qui-leve', name: 'Pâte qui lève', description: 'Rendement hors ligne porté à 65 %',
    cost: 2, branch: 'nuit', requires: ['carnet'], effect: { type: 'offlineEfficiency', value: 0.65 },
  },
  {
    id: 'levain', name: 'Levain naturel', description: 'Rendement hors ligne porté à 80 %',
    cost: 8, branch: 'nuit', requires: ['pate-qui-leve'], effect: { type: 'offlineEfficiency', value: 0.8 },
  },
  {
    id: 'fermentation', name: 'Fermentation longue', description: 'Rendement hors ligne porté à 100 %',
    cost: 28, branch: 'nuit', requires: ['levain'], effect: { type: 'offlineEfficiency', value: 1 },
  },
  {
    id: 'four-chaud', name: 'Four qui garde la chaleur', description: 'Plafond hors ligne porté à 12 heures',
    cost: 4, branch: 'nuit', requires: ['carnet'], effect: { type: 'offlineCap', hours: 12 },
  },
  {
    id: 'chambre-froide', name: 'Chambre froide', description: 'Plafond hors ligne porté à 18 heures',
    cost: 14, branch: 'nuit', requires: ['four-chaud'], effect: { type: 'offlineCap', hours: 18 },
  },
  {
    id: 'veilleuse', name: 'Veilleuse', description: 'Plafond hors ligne porté à 24 heures',
    cost: 35, branch: 'nuit', requires: ['chambre-froide'], effect: { type: 'offlineCap', hours: 24 },
  },

  /* --- La brigade : automatisation --- */
  {
    id: 'apprenti-motive', name: 'Apprenti motivé', description: 'Chaque nouvelle partie commence avec 10 apprentis',
    cost: 3, branch: 'brigade', requires: ['carnet'],
    effect: { type: 'startGenerators', id: 'apprenti', count: 10 },
  },
  {
    id: 'mise-de-depart', name: 'Mise de départ', description: 'Chaque nouvelle partie commence avec 1 000 pizzas',
    cost: 9, branch: 'brigade', requires: ['apprenti-motive'], effect: { type: 'startPizzas', amount: 1000 },
  },
  {
    id: 'brigade-complete', name: 'Brigade complète', description: 'Chaque nouvelle partie commence avec 25 fours à bois',
    cost: 30, branch: 'brigade', requires: ['mise-de-depart'],
    effect: { type: 'startGenerators', id: 'four', count: 25 },
  },
  {
    id: 'petrisseur-auto', name: 'Pétrisseur automatique', description: 'Pétrit tout seul une fois par seconde',
    cost: 12, branch: 'brigade', requires: ['apprenti-motive'], effect: { type: 'autoClick', perSecond: 1 },
  },
  {
    id: 'petrisseur-industriel', name: 'Pétrisseur industriel', description: 'Pétrit tout seul 5 fois par seconde',
    cost: 32, branch: 'brigade', requires: ['petrisseur-auto'], effect: { type: 'autoClick', perSecond: 5 },
  },
  {
    id: 'commis', name: 'Commis aux achats', description: 'Achète tout seul la cuisine la plus rentable',
    cost: 20, branch: 'brigade', requires: ['apprenti-motive'], effect: { type: 'autoBuyGenerators' },
  },
  {
    id: 'chef-des-achats', name: 'Chef des achats', description: 'Achète tout seul les améliorations abordables',
    cost: 45, branch: 'brigade', requires: ['commis'], effect: { type: 'autoBuyUpgrades' },
  },
];

export const PRESTIGE_NODES_BY_ID: Readonly<Record<string, PrestigeNodeDef>> = Object.fromEntries(
  PRESTIGE_TREE.map((n) => [n.id, n]),
);
