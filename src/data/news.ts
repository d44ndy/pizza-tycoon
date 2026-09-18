/**
 * « La Gazette de la Pâte » : le fil d'actualité qui défile en haut de l'écran.
 *
 * Chaque dépêche a une condition d'apparition. Le ton suit l'empire : on commence par
 * des plaintes de voisinage, on finit par renommer la Lune. Comme les hauts faits,
 * ce sont des DONNÉES — la condition est interprétée par `engine/news.ts`.
 *
 * Contrainte d'écriture : aucune personne, marque ou enseigne réelle. Les villes du
 * jeu (Naples, Chicago…) sont des lieux, pas des marques.
 */
import type { GeneratorId } from './generators.ts';
import type { FlagId } from './achievements.ts';
import type { CityId } from './cities.ts';

export type NewsCondition =
  /** Toujours disponible (une fois le fil d'actualité affiché). */
  | { readonly type: 'always' }
  /** Uniquement en début de partie : disparaît une fois ce cumul dépassé. */
  | { readonly type: 'before'; readonly amount: string }
  | { readonly type: 'earnedTotal'; readonly amount: string }
  | { readonly type: 'generatorOwned'; readonly id: GeneratorId; readonly count: number }
  | { readonly type: 'clicksTotal'; readonly count: number }
  | { readonly type: 'eventsClicked'; readonly count: number }
  | { readonly type: 'achievementsOwned'; readonly count: number }
  | { readonly type: 'flag'; readonly flag: FlagId }
  | { readonly type: 'prestiges'; readonly count: number }
  | { readonly type: 'challengeActive' }
  | { readonly type: 'challengesCompleted'; readonly count: number }
  | { readonly type: 'cityFounded'; readonly id: CityId }
  | { readonly type: 'transcendences'; readonly count: number };

export type NewsDef = {
  readonly id: string;
  readonly text: string;
  readonly condition: NewsCondition;
};

export const NEWS: readonly NewsDef[] = [
  /* --- Le garage --- */
  { id: 'garage-odeur', condition: { type: 'before', amount: '1e5' },
    text: 'Un voisin affirme avoir senti une odeur de pâte « prometteuse » en provenance d’un garage.' },
  { id: 'garage-mamie', condition: { type: 'before', amount: '1e5' },
    text: 'Ta grand-mère a appelé : elle trouve que tu devrais « chercher un vrai travail ».' },
  { id: 'garage-bruit', condition: { type: 'before', amount: '1e6' },
    text: 'Plainte au commissariat : quelqu’un pétrirait de la pâte à trois heures du matin.' },
  { id: 'garage-mairie', condition: { type: 'before', amount: '1e6' },
    text: 'La mairie rappelle qu’un garage n’est pas un local homologué pour la restauration.' },

  /* --- Les cuisines --- */
  { id: 'cuisine-apprenti', condition: { type: 'generatorOwned', id: 'apprenti', count: 1 },
    text: 'Petite annonce : « Apprenti pizzaïolo cherche patron. » Ah, non, c’est réglé.' },
  { id: 'cuisine-four', condition: { type: 'generatorOwned', id: 'four', count: 1 },
    text: 'Les pompiers rappellent qu’un four à bois dans un garage n’est « pas une bonne idée ». Personne n’écoute.' },
  { id: 'cuisine-scooter', condition: { type: 'generatorOwned', id: 'scooter', count: 1 },
    text: 'Un scooter de livraison flashé à contresens. Il roulait, selon lui, « dans le sens de l’histoire ».' },
  { id: 'cuisine-camion', condition: { type: 'generatorOwned', id: 'camion', count: 1 },
    text: 'Le camion pizza élu « meilleur restaurant garé en double file » du quartier.' },
  { id: 'cuisine-pizzeria', condition: { type: 'generatorOwned', id: 'pizzeria', count: 1 },
    text: 'Critique gastronomique : « Une nappe à carreaux d’une grande sincérité. »' },
  { id: 'cuisine-franchise', condition: { type: 'generatorOwned', id: 'franchise', count: 1 },
    text: 'Deux de tes franchises ouvrent face à face. Elles passent la soirée à se livrer mutuellement.' },
  { id: 'cuisine-usine', condition: { type: 'generatorOwned', id: 'usine', count: 1 },
    text: 'Météo : averses de farine sur la zone industrielle en fin de journée. Prévoir un tablier.' },
  { id: 'cuisine-robot', condition: { type: 'generatorOwned', id: 'robot', count: 1 },
    text: 'Un robot pizzaïolo demande des congés payés. Refusé : il n’a pas de contrat, ni de pieds.' },
  { id: 'cuisine-robot-ananas', condition: { type: 'generatorOwned', id: 'robot', count: 25 },
    text: 'Un robot surpris en train d’ajouter de l’ananas « pour voir ». Une enquête interne est ouverte.' },
  { id: 'cuisine-drone', condition: { type: 'generatorOwned', id: 'drone', count: 1 },
    text: 'Un drone livre une pizza à une station météo polaire. Personne n’avait commandé. Tout le monde a mangé.' },
  { id: 'cuisine-plasma', condition: { type: 'generatorOwned', id: 'plasma', count: 1 },
    text: 'Les astronomes signalent une nouvelle étoile dans le ciel du soir. C’est ton four.' },

  /* --- L'empire grandit --- */
  { id: 'empire-eau', condition: { type: 'earnedTotal', amount: '1e6' },
    text: 'Les nutritionnistes s’inquiètent : la ville consommerait désormais plus de pizza que d’eau.' },
  { id: 'empire-banque', condition: { type: 'earnedTotal', amount: '1e9' },
    text: 'La banque centrale étudie la possibilité d’indexer la monnaie sur la mozzarella.' },
  { id: 'empire-farine', condition: { type: 'earnedTotal', amount: '1e12' },
    text: 'Le cours mondial de la farine suit désormais ton humeur du matin. Sois de bonne humeur.' },
  { id: 'empire-ocean', condition: { type: 'earnedTotal', amount: '1e15' },
    text: 'Les océanographes relèvent une salinité anormale. Après analyse, c’est de la sauce tomate.' },
  { id: 'empire-sondage', condition: { type: 'earnedTotal', amount: '1e18' },
    text: 'Une commission cherche une personne n’ayant jamais mangé tes pizzas. Les recherches continuent.' },
  { id: 'empire-lune', condition: { type: 'earnedTotal', amount: '1e24' },
    text: 'La Lune rebaptisée « Quatre-Fromages » à l’unanimité moins une voix (le Soleil, jaloux).' },
  { id: 'empire-univers', condition: { type: 'earnedTotal', amount: '1e30' },
    text: 'Les physiciens confirment que l’univers est plat. Comme une pâte fine, précisent-ils.' },

  /* --- Les mains --- */
  { id: 'clic-kine', condition: { type: 'clicksTotal', count: 1000 },
    text: 'Un kinésithérapeute ouvre un cabinet juste en face de chez toi. Il dit que c’est une coïncidence.' },
  { id: 'clic-avant-bras', condition: { type: 'clicksTotal', count: 10000 },
    text: 'Tes avant-bras viennent de recevoir leur propre code postal.' },

  /* --- Pizzas d'or --- */
  { id: 'or-ciel', condition: { type: 'eventsClicked', count: 1 },
    text: 'Des témoins ont vu une pizza dorée traverser le ciel. La préfecture parle d’« un reflet ».' },
  { id: 'or-chasseurs', condition: { type: 'eventsClicked', count: 25 },
    text: 'Un club de chasseurs de pizzas d’or se forme. Premier règlement : ne jamais toucher aux grises.' },
  { id: 'or-hygiene', condition: { type: 'flag', flag: 'malusClicked' },
    text: 'Le service d’hygiène publie son rapport sur ta cuisine. Page 1 : « Ah. »' },
  { id: 'or-pourboire', condition: { type: 'flag', flag: 'jackpot' },
    text: 'Un pourboire si généreux que l’économie locale entre en récession, puis en expansion, puis en pause déjeuner.' },

  /* --- Secrets et curiosités --- */
  { id: 'secret-ananas', condition: { type: 'flag', flag: 'pineapple' },
    text: 'Le débat sur l’ananas fait trois blessés légers lors du conseil municipal. L’ordre du jour est reporté.' },
  { id: 'secret-nuit', condition: { type: 'flag', flag: 'nightOwl' },
    text: 'Il est très tard. Même les fours dorment. Enfin, pas les tiens.' },
  { id: 'secret-froide', condition: { type: 'flag', flag: 'coldPizza' },
    text: 'Étude : la pizza froide du lendemain serait meilleure que la pizza chaude. Tes cuisines démentent.' },
  { id: 'trophees', condition: { type: 'achievementsOwned', count: 25 },
    text: 'Une vitrine à trophées s’effondre sous son propre poids. On en commande une plus grande.' },
  { id: 'trophees-mur', condition: { type: 'achievementsOwned', count: 60 },
    text: 'Tes diplômes encadrés couvrent désormais trois murs et une partie du plafond.' },

  /* --- Recettes secrètes --- */
  { id: 'prestige-1', condition: { type: 'prestiges', count: 1 },
    text: 'Un pizzaïolo brûle son empire pour une meilleure recette. Les voisins, eux, n’ont vu que la fumée.' },
  { id: 'prestige-3', condition: { type: 'prestiges', count: 3 },
    text: '« Recommencer, c’est apprendre », déclare un homme qui a recommencé beaucoup de fois.' },
  { id: 'prestige-10', condition: { type: 'prestiges', count: 10 },
    text: 'Les historiens renoncent à dater ton empire : il a déjà recommencé dix fois.' },

  /* --- Défis --- */
  { id: 'defi-regles', condition: { type: 'challengeActive' },
    text: 'Rumeur en cuisine : le patron s’impose des règles absurdes « pour le sport ».' },
  { id: 'defi-4', condition: { type: 'challengesCompleted', count: 4 },
    text: 'Le patron relève les défis les uns après les autres. Le personnel, lui, relève les manches.' },

  /* --- Expansion mondiale --- */
  { id: 'ville-naples', condition: { type: 'cityFounded', id: 'naples' },
    text: 'Naples t’accueille avec méfiance, puis avec une assiette. C’est bon signe.' },
  { id: 'ville-chicago', condition: { type: 'cityFounded', id: 'chicago' },
    text: 'Chicago débat : ta pizza est-elle assez épaisse pour mériter le nom de pizza ?' },
  { id: 'ville-tokyo', condition: { type: 'cityFounded', id: 'tokyo' },
    text: 'À Tokyo, ta pizzeria est si ponctuelle que les trains règlent leur horloge sur elle.' },
  { id: 'ville-paris', condition: { type: 'cityFounded', id: 'paris' },
    text: 'À Paris, la file d’attente devant ta pizzeria a désormais sa propre file d’attente.' },
  { id: 'ville-saopaulo', condition: { type: 'cityFounded', id: 'saopaulo' },
    text: 'São Paulo ne dort jamais. Tes livreurs non plus : c’était dans le contrat.' },
  { id: 'ville-orbite', condition: { type: 'cityFounded', id: 'orbite' },
    text: 'La station orbitale livre en quatre minutes partout sur Terre, et en huit ans sur Mars.' },
  { id: 'expansion-cartes', condition: { type: 'transcendences', count: 1 },
    text: 'Les cartes du monde sont réimprimées. La légende tient désormais dans une part de pizza.' },

  /* --- Brèves de toujours --- */
  { id: 'breve-sondage', condition: { type: 'always' },
    text: 'Sondage : 97 % des gens préfèrent la pizza. Les 3 % restants mangeaient une pizza pendant le sondage.' },
  { id: 'breve-philo', condition: { type: 'always' },
    text: 'Un philosophe s’interroge : une pizza livrée à un domicile vide est-elle encore chaude ?' },
  { id: 'breve-archeo', condition: { type: 'always' },
    text: 'Découverte archéologique majeure : une croûte de pizza datant de mardi dernier.' },
  { id: 'breve-horoscope', condition: { type: 'always' },
    text: 'Horoscope : une part de pizza va changer ta journée. Valable pour les douze signes.' },
  { id: 'breve-meteo', condition: { type: 'always' },
    text: 'Météo du jour : ciel dégagé, légère brise, odeur de basilic sur l’ensemble du territoire.' },
  { id: 'breve-sport', condition: { type: 'always' },
    text: 'Sport : le lancer de pâte devient discipline de démonstration. Les juges notent aussi la garniture.' },
];

export const NEWS_BY_ID: Readonly<Record<string, NewsDef>> = Object.fromEntries(NEWS.map((n) => [n.id, n]));

/** Délai entre deux dépêches, en millisecondes. */
export const NEWS_INTERVAL_MS = 12000;
