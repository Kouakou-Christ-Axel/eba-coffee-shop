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
  // Quantité déjà demandée par des commandes NON encore réservées
  // (`getPendingDemand`, lib/orders/pending-demand.ts) — fusionné à part de
  // `getMenu()`, comme `popularRank` ci-dessus, et seulement là où le staff en
  // a besoin (caisse) ; absent côté public.
  pending?: number;
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
