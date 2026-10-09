/** Preuve sociale de la carte publique (« Le plus commandé », « #2 des ventes »). */
export const POPULARITY_WINDOW_DAYS = 30;

export const POPULARITY_MIN_ORDERS = 5;

export const POPULARITY_RANKED_COUNT = 3;

export const SHOWCASE_MAX_PRODUCTS = 8;

export const SHOWCASE_MIN_PRODUCTS = 3;

export const UPSELL_MAX_PRODUCTS = 6;

/** Carte publique — recherche et navigation par catégories. */
export const CARTE_SEARCH_MIN_CHARS = 2;

/** Dégradés du repli visuel d'un produit sans photo (`ProductMedia`, components/(public)/carte/_components/product-media.tsx). */
export const MONOGRAM_GRADIENTS = [
  'linear-gradient(135deg, rgb(247 239 232) 0%, rgb(233 220 240) 100%)',
  'linear-gradient(135deg, rgb(253 250 246) 0%, rgb(244 214 175) 100%)',
  'linear-gradient(135deg, rgb(240 229 238) 0%, rgb(214 190 225) 100%)',
  'linear-gradient(135deg, rgb(250 243 235) 0%, rgb(226 222 240) 100%)',
] as const;

export const CARTE_SCROLL_OFFSET_PX = 80;

export const CARTE_SCROLL_LOCK_MS = 800;

export const CARTE_SCROLL_SPY_GAP_PX = 24;

export const CARTE_SCROLL_SPY_BOTTOM_MARGIN = '60%';

export const HOME_FEATURED_MAX_PRODUCTS = 6;

/** Répartitions de parts les plus choisies (« Oreo ×2 · Coco ×1 — 34 fois »), proposées en un appui dans le composeur de boîtes. */
export const PORTION_COMBO_MIN_ORDERS = 3;

export const PORTION_COMBO_MAX = 3;

/** Commande à l'avance : délai max (jours) qu'un produit ou une catégorie peut exiger avant retrait. */
export const ADVANCE_ORDER_DAYS_MAX = 30;

export const PICKUP_MIN_VISIBLE_DAYS = 7;
