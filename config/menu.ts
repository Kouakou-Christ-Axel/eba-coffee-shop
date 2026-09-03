// config/menu.ts

export type SupplementOption = {
  name: string;
  price: number;
  // Stock vendable courant (absent/`null` = illimité). `remaining`/`soldOut`
  // sont dérivés côté lecture (`lib/menu.ts` getMenu()) à partir de la même
  // valeur brute.
  stockQuantity?: number | null;
  remaining?: number | null;
  soldOut?: boolean;
};

export type SupplementGroup = {
  name: string;
  type: 'single' | 'multiple' | 'quantity';
  required: boolean;
  // Bornes sur le nombre d'options cochées ('multiple') ou sur la quantité
  // totale répartie ('quantity'). Absent/null = pas de borne.
  minSelect?: number | null;
  maxSelect?: number | null;
  options: SupplementOption[];
  // Groupe « Extras » global (configuré une fois, proposé sur tous les
  // produits) plutôt que propre à ce produit. Purement informatif côté
  // affichage (ex. section « Extras » séparée dans le sélecteur).
  isGlobal?: boolean;
};

export type Product = {
  id: string;
  name: string;
  description: string;
  price: number;
  coutMatiere?: number;
  coutEmballage?: number;
  image?: string;
  supplements?: SupplementGroup[];
  featured?: boolean;
  featuredOrder?: number;
  featuredBadge?: string;
  // Preuve sociale (« #1 le plus commandé ») : rang au classement des ventes
  // sur la fenêtre glissante `POPULARITY_WINDOW_DAYS`, 1 = le plus vendu.
  // Calculé à part de `getMenu()` (voir `lib/menu-popularity.ts`) et fusionné
  // côté page carte — absent partout ailleurs (ex. `/api/menu`).
  //
  // Le RANG seul est publié, jamais le volume de ventes : un « 6 commandés »
  // dessert le produit qu'il est censé vendre, et nos volumes n'ont pas à
  // sortir du back-office.
  popularRank?: number;
  // Répartitions de parts les plus choisies (voir `PortionCombo`). Vide ou
  // absent = rien d'assez fréquent à proposer.
  portionCombos?: PortionCombo[];
  // Stock vendable courant (absent/`null` = illimité) et champs dérivés
  // (voir `SupplementOption` ci-dessus pour la même sémantique).
  stockQuantity?: number | null;
  remaining?: number | null;
  soldOut?: boolean;
  // Pause programmée (ISO 8601) ; `null`/absent = pas de pause. Le calcul
  // « en pause maintenant » (`unavailableUntil > now`) se fait côté lecture.
  unavailableUntil?: string | null;
  // Planning récurrent effectif (0=dimanche…6=samedi), résolu à la lecture en
  // intersectant le planning du produit ET celui de sa catégorie (voir
  // `intersectAvailableDays`, lib/menu.ts). `undefined`/absent = tous les
  // jours ; un tableau MÊME VIDE = aucun jour commun (jamais disponible) — voir
  // `isAvailableToday` (lib/supplements.ts).
  availableDays?: number[];
  // Fenêtre(s) « spécialité de la semaine » (0, 1 ou plusieurs, rare passage
  // reconduit). Vide/absent = pas de restriction. Dès qu'au moins une fenêtre
  // existe, le produit n'est commandable QUE dans une fenêtre active — voir
  // `isWithinAnyPeriod` (lib/supplements.ts).
  weeklySpecialPeriods?: { startDate: string; endDate: string }[];
  // Commande à l'avance obligatoire (jours civils), délai EFFECTIF = maximum
  // entre celui du produit et celui de sa catégorie (voir
  // `effectiveAdvanceOrderDays`, lib/menu.ts). `undefined`/absent = pas de
  // contrainte. N'empêche PAS l'ajout au panier : seule la date de retrait
  // choisie au checkout est contrainte — voir `isPickupDateAllowed`
  // (lib/supplements.ts).
  advanceOrderDays?: number;
  // Commande spéciale sur mesure (ex. gâteau grand format) : exige un acompte
  // minimum au checkout (voir `MIN_DEPOSIT_PERCENT`, config/constants.ts, et
  // `lib/deposits.ts`). `undefined`/absent = pas d'acompte exigé.
  requiresDeposit?: boolean;
};

/**
 * Répartition d'une boîte à parts fixes réellement choisie par des clients
 * (ex. « Oreo ×2 · Coco ×1 »), avec le nombre de fois. Proposée en un appui
 * dans le composeur de parts — l'équivalent du « Most popular » d'Uber Eats,
 * mais adossé aux commandes passées plutôt qu'à une saisie manuelle.
 *
 * Calculée à part de `getMenu()` (voir `lib/portion-combos.ts`) et fusionnée
 * côté page carte — absente partout ailleurs (ex. `/api/menu`).
 */
export type PortionCombo = {
  /** Groupe de goûts auquel la répartition s'applique. */
  groupName: string;
  /** Quantité par goût. La somme vaut toujours la taille de la boîte. */
  counts: Record<string, number>;
  /** Nombre de commandes ayant retenu cette répartition. */
  orders: number;
};

export type MenuCategory = {
  id: string;
  name: string;
  products: Product[];
  // Planning récurrent propre à la catégorie (0=dimanche…6=samedi), ex. « menu
  // brunch » le week-end seulement. `undefined`/absent = tous les jours. Sert
  // au message affiché en en-tête de section (voir `isAvailableToday`,
  // lib/supplements.ts) — indépendant de `Product.availableDays`, qui l'a déjà
  // intégré par intersection pour chaque produit.
  availableDays?: number[];
  // Délai de commande à l'avance propre à la catégorie (jours civils), déjà
  // intégré par maximum dans `Product.advanceOrderDays` de chaque produit —
  // exposé ici pour un éventuel message d'en-tête de section.
  advanceOrderDays?: number;
};

const milkChoice: SupplementGroup = {
  name: 'Choix du lait',
  type: 'single',
  required: false,
  options: [
    { name: 'Lait classique', price: 0 },
    { name: 'Lait d\u2019avoine', price: 500 },
    { name: 'Lait d\u2019amande', price: 500 },
  ],
};

const coffeeExtras: SupplementGroup = {
  name: 'Extras',
  type: 'multiple',
  required: false,
  options: [
    { name: 'Shot espresso', price: 300 },
    { name: 'Sirop vanille', price: 200 },
    { name: 'Sirop caramel', price: 200 },
    { name: 'Chantilly', price: 300 },
  ],
};

export const menu: MenuCategory[] = [
  {
    id: 'boissons-chaudes',
    name: 'Boissons chaudes',
    products: [
      {
        id: 'espresso',
        name: 'Espresso',
        description: 'Court et intense',
        price: 1500,
        supplements: [coffeeExtras],
      },
      {
        id: 'cappuccino',
        name: 'Cappuccino Signature',
        description:
          'Notre espresso maison, mousse de lait soyeuse et une touche de cacao torréfié.',
        price: 3500,
        image: '/assets/examples/accueil/eba-hero-2.webp',
        featured: true,
        featuredOrder: 1,
        featuredBadge: 'Best-seller',
        supplements: [milkChoice, coffeeExtras],
      },
      {
        id: 'latte-vanille',
        name: 'Latte Vanille',
        description:
          'Espresso doux, lait vapeur et sirop de vanille de Madagascar, servi chaud.',
        price: 4000,
        image: '/assets/examples/accueil/eba-hero-2.webp',
        featured: true,
        featuredOrder: 2,
        featuredBadge: 'Coup de cœur',
        supplements: [milkChoice, coffeeExtras],
      },
      {
        id: 'chocolat-chaud',
        name: 'Chocolat Chaud',
        description: 'Chocolat de couverture, lait entier',
        price: 3000,
        supplements: [milkChoice],
      },
      {
        id: 'the-infusion',
        name: 'Thé & Infusion',
        description: 'Sélection de thés et infusions',
        price: 2000,
      },
    ],
  },
  {
    id: 'boissons-fraiches',
    name: 'Boissons fraîches',
    products: [
      {
        id: 'cafe-glace',
        name: 'Café Glacé',
        description: 'Espresso sur glace, lait froid',
        price: 3500,
        supplements: [milkChoice],
      },
      {
        id: 'jus-frais',
        name: 'Jus Frais du Jour',
        description: 'Fruits frais pressés sur place',
        price: 3000,
      },
      {
        id: 'smoothie-mangue',
        name: 'Smoothie Mangue',
        description: 'Mangue, banane, lait de coco',
        price: 4000,
      },
      {
        id: 'limonade',
        name: 'Limonade Maison',
        description: 'Citron frais, menthe, sucre de canne',
        price: 2500,
      },
    ],
  },
  {
    id: 'patisseries',
    name: 'Pâtisseries',
    products: [
      {
        id: 'croissant-amande',
        name: 'Croissant Amande',
        description:
          'Pâte feuilletée beurrée, crème d’amande maison et amandes effilées dorées.',
        price: 2500,
        image: '/assets/examples/accueil/eba-hero.webp',
        featured: true,
        featuredOrder: 3,
      },
      {
        id: 'pain-chocolat',
        name: 'Pain au Chocolat',
        description: 'Chocolat noir, beurre AOP',
        price: 2000,
      },
      {
        id: 'tarte-fruits',
        name: 'Tarte aux Fruits',
        description: 'Fruits de saison, crème pâtissière',
        price: 3500,
      },
      {
        id: 'cookie-chocolat',
        name: 'Cookie Chocolat',
        description: 'Pépites de chocolat, fleur de sel',
        price: 1500,
      },
      {
        id: 'eclair-cafe',
        name: 'Éclair Café',
        description: 'Crème café, glaçage fondant',
        price: 3000,
      },
    ],
  },
  {
    id: 'brunch-sale',
    name: 'Brunch & Salé',
    products: [
      {
        id: 'formule-brunch',
        name: 'Formule Brunch',
        description: 'Boisson chaude, viennoiserie, œufs, jus',
        price: 8500,
      },
      {
        id: 'toast-avocat',
        name: 'Toast Avocat',
        description: 'Pain complet, avocat, œuf poché',
        price: 5000,
      },
      {
        id: 'croque-eba',
        name: 'Croque EBA',
        description: 'Jambon, fromage gratiné, salade',
        price: 4500,
      },
      {
        id: 'salade-marche',
        name: 'Salade du Marché',
        description: 'Légumes frais, vinaigrette maison',
        price: 4000,
      },
    ],
  },
];

export const priceFormatter = new Intl.NumberFormat('fr-FR');
