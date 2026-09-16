/**
 * Les améliorations : multiplicateurs de cuisine, puissance de clic et synergies.
 *
 * Tout est DONNÉE (pas de closure) : une amélioration se décrit par une condition de
 * déblocage et un effet, tous deux interprétés par `engine/formulas.ts`. C'est ce qui
 * permet au simulateur d'équilibrage de les rejouer sans interface.
 */
import { D, type Decimal } from '../engine/decimal.ts';
import { GENERATORS, type GeneratorId } from './generators.ts';

export type UpgradeCategory = 'generator' | 'click' | 'synergy';

/** Condition de déblocage (l'amélioration n'apparaît dans la boutique qu'une fois remplie). */
export type UpgradeCondition =
  | { readonly type: 'generatorOwned'; readonly id: GeneratorId; readonly count: number }
  | { readonly type: 'clicksTotal'; readonly count: number }
  | { readonly type: 'both'; readonly a: UpgradeCondition; readonly b: UpgradeCondition };

/** Effet appliqué tant que l'amélioration est possédée. */
export type UpgradeEffect =
  /** Multiplie la production d'une cuisine. */
  | { readonly type: 'generatorMult'; readonly target: GeneratorId; readonly factor: number }
  /** Chaque exemplaire de `source` ajoute `perUnit` (en %) à la production de `target`. */
  | { readonly type: 'synergy'; readonly target: GeneratorId; readonly source: GeneratorId; readonly perUnit: number }
  /** Multiplie la valeur du clic. */
  | { readonly type: 'clickMult'; readonly factor: number }
  /** Le clic rapporte en plus un pourcentage de la production par seconde. */
  | { readonly type: 'clickFromProduction'; readonly percent: number };

export type UpgradeDef = {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly cost: Decimal;
  readonly category: UpgradeCategory;
  /** Pictogramme à afficher (identifiant de cuisine, ou un picto générique). */
  readonly icon: GeneratorId | 'click' | 'synergy';
  readonly unlock: UpgradeCondition;
  readonly effect: UpgradeEffect;
};

/* ------------------------------------------------------------------ */
/* Améliorations de cuisine : ×2 à 1, 10, 75, 175 et 275 exemplaires   */
/* ------------------------------------------------------------------ */

/**
 * Seuils du cahier des charges. Ils tombent volontairement sur les mêmes nombres que
 * les paliers de production (25, 50, 100) : à ces trois seuils, le joueur encaisse donc
 * un saut ×4 (palier ×2 et amélioration ×2 le même jour) suivi d'un plat plus long.
 * C'est le comportement demandé, et c'est aussi celui de Cookie Clicker.
 */
const UPGRADE_THRESHOLDS = [1, 5, 25, 50, 100] as const;

/** Coût : 10× le coût de base de la cuisine, puis ×5 à chaque cran. */
const UPGRADE_COST_FACTORS = [10, 50, 250, 1250, 6250] as const;

/** Cinq noms par cuisine, du plus modeste au plus délirant. */
const UPGRADE_NAMES: Record<GeneratorId, readonly [string, string, string, string, string]> = {
  apprenti: ['Tablier propre', 'Deuxième main', 'Cours du soir', "Contrat d'alternance", 'Syndicat des apprentis'],
  four: ['Bois sec', 'Sole en pierre', 'Tirage réglé', 'Braises éternelles', 'Chêne centenaire'],
  scooter: ['Pneus neufs', 'Sacoche isotherme', 'Raccourci par la ruelle', 'Pot débridé', 'Permis enfin passé'],
  camion: ['Groupe électrogène', 'Auvent rétractable', 'Place au marché', 'Klaxon musical', 'Convoi de camions'],
  pizzeria: ['Nappe à carreaux', 'Terrasse chauffée', 'Avis cinq étoiles', 'Livre de réservations', "Salle à l'étage"],
  franchise: ['Manuel de procédures', 'Formation express', "Centrale d'achat", "Campagne d'affichage", 'Introduction en bourse'],
  usine: ['Pétrin industriel', 'Ligne de production', 'Équipe de nuit', 'Farine en silo', 'Automatisation totale'],
  robot: ['Bras articulé', 'Capteur de cuisson', 'Mise à jour du firmware', 'Apprentissage profond', 'Conscience de la croûte'],
  drone: ['Batterie longue durée', 'Couloir aérien', 'Essaim coordonné', 'Rentrée atmosphérique', 'Largage orbital'],
  plasma: ['Confinement magnétique', 'Miroir solaire', 'Cuisson en 4 ms', 'Alignement des planètes', "Croûte de l'horizon"],
};

function generatorUpgrades(): UpgradeDef[] {
  const list: UpgradeDef[] = [];
  for (const def of GENERATORS) {
    UPGRADE_THRESHOLDS.forEach((threshold, i) => {
      list.push({
        id: `${def.id}-${i + 1}`,
        name: UPGRADE_NAMES[def.id][i]!,
        description: `${def.name} : production ×2`,
        cost: def.baseCost.mul(UPGRADE_COST_FACTORS[i]!),
        category: 'generator',
        icon: def.id,
        unlock: { type: 'generatorOwned', id: def.id, count: threshold },
        effect: { type: 'generatorMult', target: def.id, factor: 2 },
      });
    });
  }
  return list;
}

/* ------------------------------------------------------------------ */
/* Synergies : chaque cuisine pousse la suivante                        */
/* ------------------------------------------------------------------ */

const SYNERGY_NAMES: readonly string[] = [
  'Bras pour enfourner',
  'Toujours chaudes au départ',
  'Repérage des rues',
  'Publicité roulante',
  'Recette éprouvée',
  'Commandes en gros',
  'Pâte calibrée',
  'Chargement automatisé',
  'Ravitaillement orbital',
];

function synergyUpgrades(): UpgradeDef[] {
  const list: UpgradeDef[] = [];
  for (let i = 1; i < GENERATORS.length; i++) {
    const source = GENERATORS[i - 1]!;
    const target = GENERATORS[i]!;
    list.push({
      id: `synergie-${target.id}`,
      name: SYNERGY_NAMES[i - 1]!,
      description: `Chaque ${source.name} améliore ${target.name} de +1 %`,
      cost: target.baseCost.mul(100),
      category: 'synergy',
      icon: 'synergy',
      unlock: {
        type: 'both',
        a: { type: 'generatorOwned', id: source.id, count: 15 },
        b: { type: 'generatorOwned', id: target.id, count: 1 },
      },
      effect: { type: 'synergy', target: target.id, source: source.id, perUnit: 1 },
    });
  }
  return list;
}

/* ------------------------------------------------------------------ */
/* Améliorations de clic                                                */
/* ------------------------------------------------------------------ */

const CLICK_UPGRADES: readonly UpgradeDef[] = [
  {
    id: 'clic-1', name: "Poignet d'acier", description: 'Le pétrissage rapporte deux fois plus',
    cost: D(100), category: 'click', icon: 'click',
    unlock: { type: 'clicksTotal', count: 25 }, effect: { type: 'clickMult', factor: 2 },
  },
  {
    id: 'clic-2', name: 'Deux mains', description: 'Le pétrissage rapporte deux fois plus',
    cost: D(2500), category: 'click', icon: 'click',
    unlock: { type: 'clicksTotal', count: 150 }, effect: { type: 'clickMult', factor: 2 },
  },
  {
    id: 'clic-3', name: 'Pétrin à levier', description: 'Le pétrissage rapporte deux fois plus',
    cost: D(80e3), category: 'click', icon: 'click',
    unlock: { type: 'clicksTotal', count: 600 }, effect: { type: 'clickMult', factor: 2 },
  },
  {
    id: 'clic-4', name: 'Pâte télépathique', description: 'Le pétrissage rapporte deux fois plus',
    cost: D(5e6), category: 'click', icon: 'click',
    unlock: { type: 'clicksTotal', count: 2500 }, effect: { type: 'clickMult', factor: 2 },
  },
  {
    id: 'clic-5', name: 'Le clic cosmique', description: 'Le pétrissage rapporte deux fois plus',
    cost: D(2e10), category: 'click', icon: 'click',
    unlock: { type: 'clicksTotal', count: 10000 }, effect: { type: 'clickMult', factor: 2 },
  },
  {
    id: 'clic-prod-1', name: 'Main dans la pâte', description: 'Un clic rapporte en plus 1 % de ta production par seconde',
    cost: D(1500), category: 'click', icon: 'click',
    unlock: { type: 'both', a: { type: 'clicksTotal', count: 50 }, b: { type: 'generatorOwned', id: 'four', count: 1 } },
    effect: { type: 'clickFromProduction', percent: 1 },
  },
  {
    id: 'clic-prod-2', name: 'Doigts de fée', description: 'Un clic rapporte en plus 2 % de ta production par seconde',
    cost: D(250e3), category: 'click', icon: 'click',
    unlock: { type: 'clicksTotal', count: 500 }, effect: { type: 'clickFromProduction', percent: 2 },
  },
  {
    id: 'clic-prod-3', name: 'Toucher du chef', description: 'Un clic rapporte en plus 5 % de ta production par seconde',
    cost: D(120e6), category: 'click', icon: 'click',
    unlock: { type: 'clicksTotal', count: 2000 }, effect: { type: 'clickFromProduction', percent: 5 },
  },
  {
    id: 'clic-prod-4', name: 'Instinct du pizzaïolo', description: 'Un clic rapporte en plus 10 % de ta production par seconde',
    cost: D(90e9), category: 'click', icon: 'click',
    unlock: { type: 'clicksTotal', count: 8000 }, effect: { type: 'clickFromProduction', percent: 10 },
  },
];

export const UPGRADES: readonly UpgradeDef[] = [
  ...generatorUpgrades(),
  ...synergyUpgrades(),
  ...CLICK_UPGRADES,
];

export const UPGRADES_BY_ID: Readonly<Record<string, UpgradeDef>> = Object.fromEntries(
  UPGRADES.map((u) => [u.id, u]),
);
