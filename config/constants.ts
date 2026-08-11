// config/constants.ts
//
// Constantes numériques partagées (nombres "magiques" historiquement dispersés
// dans le code). Chaque entrée référence sa provenance pour faciliter la
// suppression du doublon dans la vague d'intégration suivante.

import type { UserRole } from '@/generated/prisma/client';

/**
 * Rôles ayant accès au dashboard. Source de vérité UNIQUE, partagée entre le
 * garde serveur (`requireDashboard`, lib/auth-helpers.ts) et l'UI publique qui
 * décide d'afficher un raccourci « Dashboard » (navbar, footer, FAB mobile).
 *
 * Pourquoi ici plutôt que dans `lib/auth-helpers.ts` : ce dernier importe
 * `next/headers`, donc inutilisable depuis un composant client. Ce fichier est
 * pur. Import de TYPE uniquement pour `UserRole` (effacé au build) — rien du
 * client Prisma ne part dans le bundle navigateur.
 *
 * L'UI publique ne fait qu'afficher/masquer un lien : l'autorisation réelle
 * reste côté serveur (le layout dashboard appelle `requireDashboard`).
 */
export const DASHBOARD_ROLES: UserRole[] = [
  'ADMIN',
  'MANAGER',
  'ASSISTANT_MANAGER',
  'CASHIER',
  'KITCHEN',
  'COMPTABLE',
  'ANALYSTE',
];

/**
 * Taille maximale d'un upload d'image en octets (25 MB).
 * Cap d'ENTRÉE : on accepte des photos de téléphone lourdes (et du HEIC), qui
 * sont ensuite redimensionnées et ré-encodées en WebP léger côté serveur
 * (lib/uploads.ts). Le fichier stocké est donc bien plus petit que cette borne.
 */
export const MAX_UPLOAD_SIZE_BYTES = 25 * 1024 * 1024;

/**
 * Plus grand côté (px) après redimensionnement. Les images plus grandes sont
 * réduites « à l'intérieur » de ce carré (ratio conservé) ; les plus petites
 * ne sont pas agrandies. 2200 px garde les reçus/factures lisibles.
 * Source : lib/uploads.ts (traitement sharp).
 */
export const IMAGE_MAX_DIMENSION = 2200;

/**
 * Preuve de paiement (capture Wave, page publique de suivi) : plafond dédié de
 * 1 Mo — bien plus strict que `MAX_UPLOAD_SIZE_BYTES` (uploads staff). L'image
 * est compressée dans le NAVIGATEUR avant envoi (lib/image-compress.ts,
 * ~100-300 Ko) ; ce plafond n'est qu'un garde-fou serveur, et il maintient ce
 * flux public sous la limite par défaut des reverse proxies (nginx : 1 Mo).
 */
export const PAYMENT_PROOF_MAX_SIZE_BYTES = 1 * 1024 * 1024;

/**
 * Taille maximale du PDF de la carte téléversé depuis le dashboard (10 MB) :
 * document imprimable, pas besoin d'un plafond aussi large que les photos
 * (`MAX_UPLOAD_SIZE_BYTES`). Stocké tel quel sur Cloudinary (`resource_type:
 * 'raw'`), sans retraitement — voir lib/cloudinary.ts.
 */
export const MENU_PDF_MAX_SIZE_BYTES = 10 * 1024 * 1024;

/**
 * Compression navigateur de la preuve de paiement : plus grand côté (px) et
 * qualité JPEG. Une capture Wave reste parfaitement lisible à 1600 px.
 */
export const PAYMENT_PROOF_MAX_DIMENSION = 1600;
export const PAYMENT_PROOF_JPEG_QUALITY = 0.82;

/** Qualité WebP (0-100) à l'encodage des images stockées. */
export const IMAGE_WEBP_QUALITY = 80;

/**
 * Durée par défaut d'un créneau de retrait (Click & Collect), en minutes.
 * Source : lib/pickup-settings.ts (DEFAULT_SETTINGS.slotIntervalMin).
 * Le réglage runtime reste lu en base via lib/pickup-settings-db.ts.
 */
export const SLOT_DURATION_MINUTES = 15;

/**
 * Durée de validité d'un code OTP (email), en secondes.
 * Source : lib/auth.ts (emailOTP.expiresIn = 60 * 5 = 300 s).
 * Exposé ici comme `OTP_TIMEOUT_SECONDS` pour clarifier la sémantique.
 */
export const OTP_TIMEOUT_SECONDS = 60 * 5;

/**
 * Longueur du code OTP envoyé par email.
 * Source : lib/auth.ts (emailOTP.otpLength).
 */
export const OTP_LENGTH = 6;

/**
 * Nombre de tentatives lors d'une collision sur l'index unique
 * (dailyDate, dailyNumber) au moment de créer une commande.
 * Source : lib/orders.ts (MAX_DAILY_NUMBER_RETRIES) et
 * lib/daily-numbering.ts (DAILY_NUMBER_MAX_RETRIES).
 */
export const DAILY_NUMBER_MAX_RETRIES = 3;

/**
 * Taille de page par défaut pour la liste paginée des commandes
 * (dashboard / admin).
 * Source : lib/orders.ts (listOrders.pageSize).
 */
export const ORDERS_PAGE_SIZE = 20;

/**
 * Recherche de commande par téléphone : nombre minimum de chiffres saisis
 * avant d'activer la comparaison « sous-chaîne de chiffres bruts ». En dessous,
 * « 07 » matcherait quasiment tous les numéros ivoiriens et noierait le
 * résultat utile.
 * Source : lib/orders/search.ts (matchesOrderSearch) + lib/orders.ts
 * (buildOrdersWhere).
 */
export const PHONE_SEARCH_MIN_DIGITS = 3;

/**
 * Longueurs max des champs de saisie commande.
 * Source : schémas Zod existants (createOrderSchema, route caisse).
 */
export const ORDER_CUSTOMER_NAME_MAX = 50;
export const ORDER_CUSTOMER_PHONE_MAX = 30;
export const ORDER_NOTE_MAX = 500;

/**
 * Longueur max du motif « client de confiance » (`Customer.trustedNote`) :
 * texte libre saisi par la gérance pour tracer la raison de l'octroi ou le
 * plafond d'ardoise convenu avec le client.
 */
export const CUSTOMER_TRUSTED_NOTE_MAX = 300;

/**
 * Page publique de suivi de commande (/commande/:id) : intervalle de
 * rafraîchissement du statut (polling léger, le SSE reste réservé au staff).
 */
export const ORDER_TRACKING_POLL_INTERVAL_MS = 15_000;

/**
 * Intervalle de polling accéléré sur la page de suivi pendant que la preuve
 * de paiement est en cours de validation par la caisse (preuve envoyée mais
 * commande pas encore payée) : le moment « paiement validé » doit se voir
 * vite. Borné dans le temps par nature — on revient à l'intervalle normal
 * dès que `isPaid` passe à vrai.
 */
export const ORDER_TRACKING_POLL_FAST_INTERVAL_MS = 5_000;

/**
 * Péremption du panier persisté en localStorage (lib/cart-store.ts) : au-delà
 * de cet âge depuis la dernière modification, le panier est vidé à la
 * réhydratation (les prix/disponibilités peuvent avoir dérivé du menu).
 */
export const CART_MAX_AGE_MS = 24 * 60 * 60 * 1000;

/**
 * Historique local « mes commandes » (lib/order-history.ts) : nombre max de
 * commandes conservées par appareil (localStorage, sans compte).
 */
export const ORDER_HISTORY_MAX = 10;

/**
 * Plafond du sélecteur de quantité de la modale produit (site public). Simple
 * garde-fou d'interface contre la saisie accidentelle : la vérité reste le
 * stock, appliqué par `useCartStore.addItem` puis au PAIEMENT
 * (lib/order-mutations.ts). Un produit à stock suivi est plafonné plus bas.
 */
export const CART_ITEM_QUANTITY_MAX = 20;

/**
 * Remise caisse : une remise (montant fixe en FCFA) appliquée à une ligne
 * d'article ne peut pas dépasser cette fraction du prix brut de la ligne.
 * Plafond métier validé côté client ET serveur.
 */
export const MAX_LINE_DISCOUNT_RATIO = 0.5;

/** Longueur max du motif de remise saisi par le caissier. */
export const ORDER_DISCOUNT_REASON_MAX = 100;

/**
 * Commandes programmées (avec créneau de retrait `pickupTime`) sur l'écran caisse.
 * - `SCHEDULED_LEAD_IN_MINUTES` : en-deçà de ce délai avant le retrait, une commande
 *   programmée quitte la section « Programmées » et rejoint le flux normal (« En cours »).
 * - `SCHEDULED_ALERT_MINUTES` : délai avant le retrait à partir duquel on signale (carillon)
 *   une commande programmée — elles ne sonnent pas à l'arrivée, seulement à l'approche.
 * Sources : app/(dashboard)/dashboard/caisse/urgency.ts + caisse-view.tsx.
 */
export const SCHEDULED_LEAD_IN_MINUTES = 60;
export const SCHEDULED_ALERT_MINUTES = 15;

/**
 * Pré-analyse IA des preuves de paiement (Wave/Orange Money), via OpenRouter
 * (lib/ai/payment-proof.ts). Stratégie à deux étages : le modèle primaire
 * (rapide/économique) traite tous les appels ; le modèle de repli (plus
 * précis) n'est sollicité qu'en cas d'échec de parsing ou de confiance basse
 * du premier passage. Inerte si `OPENROUTER_API_KEY` est absente.
 */
export const PAYMENT_PROOF_AI_MODEL_PRIMARY = 'google/gemini-2.5-flash';
export const PAYMENT_PROOF_AI_MODEL_FALLBACK = 'anthropic/claude-sonnet-4.5';
export const PAYMENT_PROOF_AI_CONFIDENCE_THRESHOLD = 0.6;

/**
 * Presets rapides (minutes à partir de maintenant) proposés en caisse pour
 * fixer/modifier le créneau de retrait d'une commande existante (ex. « le
 * livreur arrive dans 15 min », ou un retrait client plus tardif).
 * Source : app/(dashboard)/dashboard/caisse/edit-fulfillment-modal.tsx.
 */
export const PICKUP_QUICK_PRESETS_MINUTES = [15, 30, 45, 60, 120];

/**
 * Minuteur « prête, en attente de récupération » (écrans cuisine + caisse).
 * Au-delà de ce délai après le passage READY, la commande est signalée en
 * rouge : le client « fait la star » (tarde à venir chercher) — on la relance.
 * Source : `Order.readyAt` (prisma/schema.prisma).
 */
export const READY_WAIT_ALERT_MINUTES = 5;

/**
 * Suivi des dépenses (back-office). Longueurs max des champs de saisie et
 * plafond de montant (garde-fou anti-faute de frappe, en francs CFA).
 */
export const EXPENSE_CATEGORY_NAME_MAX = 50;
export const EXPENSE_SUPPLIER_MAX = 100;
export const EXPENSE_NOTE_MAX = 500;
export const EXPENSE_AMOUNT_MAX = 100_000_000;
/** Libellé d'un modèle de dépense récurrente (ex. « Loyer »). */
export const EXPENSE_RECURRING_LABEL_MAX = 50;

/** Détail par article des dépenses (référentiel + lignes). */
export const EXPENSE_ARTICLE_NAME_MAX = 60;
export const EXPENSE_ITEM_LABEL_MAX = 100;
export const EXPENSE_ITEM_UNIT_MAX = 20;
/** Nombre max de lignes de détail par dépense. */
export const EXPENSE_ITEMS_MAX = 50;
export const EXPENSE_ITEM_QUANTITY_MAX = 1_000_000;

/**
 * Investissements (apports / financements). Longueurs max des champs et plafond
 * de montant. Le plafond est plus élevé que celui des dépenses : un apport en
 * capital ou un prêt peut représenter une somme importante (en francs CFA).
 */
export const INVESTMENT_SOURCE_NAME_MAX = 50;
export const INVESTMENT_FINANCIER_MAX = 100;
export const INVESTMENT_NOTE_MAX = 500;
export const INVESTMENT_AMOUNT_MAX = 1_000_000_000;

/**
 * Régularisation de recette (ajustement manuel du CA). Le montant est signé
 * (+ ajout / − retrait) ; le plafond porte sur sa valeur absolue.
 */
export const REVENUE_ADJUSTMENT_NOTE_MAX = 500;
export const REVENUE_ADJUSTMENT_AMOUNT_MAX = 100_000_000;

/**
 * Inventaire (matières premières & consommables). Longueurs max des champs et
 * plafonds (garde-fous anti-faute de frappe). Quantités fractionnaires (kg/L) ;
 * coûts unitaires en francs CFA. `IMPORT_MAX_ROWS` borne la taille d'un import
 * Excel pour éviter un traitement trop lourd en une requête.
 */
export const INVENTORY_SKU_MAX = 40;
export const INVENTORY_NAME_MAX = 100;
export const INVENTORY_CATEGORY_MAX = 50;
export const INVENTORY_SUPPLIER_MAX = 100;
export const INVENTORY_NOTE_MAX = 500;
export const INVENTORY_QUANTITY_MAX = 1_000_000;
export const INVENTORY_UNIT_COST_MAX = 100_000_000;
export const INVENTORY_IMPORT_MAX_ROWS = 1000;

/**
 * Seuil de stock bas (produit ou option) déclenchant l'affichage « Plus que N »
 * côté carte publique, au lieu d'un simple compteur non alarmant.
 * Source : `Product.stockQuantity` / `SupplementOption.stockQuantity`
 * (prisma/schema.prisma).
 */
export const LOW_STOCK_THRESHOLD = 5;

/**
 * Sondages (vote générique + suggestions de la communauté). Longueurs max des
 * champs de saisie. `POLL_VOTER_TOKEN_MAX` borne le token anonyme généré côté
 * client (garde-fou de taille, pas une limite de sécurité).
 */
export const POLL_TITLE_MAX = 120;
export const POLL_DESCRIPTION_MAX = 500;
export const POLL_OPTION_LABEL_MAX = 80;
export const POLL_OPTION_DESCRIPTION_MAX = 300;
export const POLL_SUGGESTION_LABEL_MAX = 80;
export const POLL_SUGGESTION_DESCRIPTION_MAX = 300;
export const POLL_SUGGESTION_SUBMITTER_NAME_MAX = 60;
export const POLL_REJECTION_REASON_MAX = 300;
export const POLL_VOTER_TOKEN_MAX = 100;
/** Taille de page par défaut pour les listes paginées (dashboard). */
export const POLL_LIST_PAGE_SIZE = 20;

/** Longueur max de la légende personnalisée d'une vidéo TikTok embarquée. */
export const TIKTOK_CAPTION_MAX = 300;

/**
 * Nombre max de vidéos TikTok affichées dans la section « Suivez l'aventure »
 * de l'accueil, même si davantage sont marquées actives côté dashboard — les
 * `TIKTOK_HOME_DISPLAY_MAX` premières par `sortOrder`. Source : lib/tiktok.ts
 * (listPublicTiktokVideos).
 */
export const TIKTOK_HOME_DISPLAY_MAX = 4;

/**
 * Liste publique des sondages (`/sondages`) : passée en ISR plutôt qu'en
 * `force-dynamic` pour un TTFB quasi instantané côté public. Trade-off :
 * les compteurs de votes affichés peuvent être périmés jusqu'à cette durée
 * (le détail d'un sondage, lui, reste `force-dynamic` — résultats live).
 * Les actions admin (`app/(dashboard)/dashboard/sondages/actions.ts`)
 * appellent `revalidatePath('/sondages')` pour limiter la fenêtre de
 * péremption après une création/modification/suppression.
 */
export const POLLS_REVALIDATE_SECONDS = 60;

/**
 * Fidélité — rattrapage de commandes non enregistrées (paiement cash, oubli
 * de saisie en caisse). Nombre max de commandes manquées ajoutables en une
 * fois par un admin, et longueur max de la note d'audit associée.
 * Source : lib/loyalty-mutations.ts (awardMissedOrderStamps).
 */
export const MISSED_ORDER_STAMPS_MAX = 20;
export const MISSED_ORDER_STAMPS_NOTE_MAX = 200;

/**
 * Preuve sociale de la carte publique (« Le plus commandé », « #2 des ventes »).
 * Fenêtre glissante d'agrégation des ventes, et nombre de ventes minimum pour
 * qu'un produit reçoive un rang (en dessous, un « #1 » ment au client).
 *
 * `POPULARITY_RANKED_COUNT` ne borne QUE l'affichage du badge
 * (`productBadgeLabel`) : le rang lui-même est posé sur tous les produits qui
 * passent le seuil, car il sert aussi à ordonner la vitrine. Les borner
 * ensemble faisait disparaître la vitrine dès qu'un des trois premiers était
 * indisponible. Source : `lib/menu-popularity.ts`.
 */
export const POPULARITY_WINDOW_DAYS = 30;
export const POPULARITY_MIN_ORDERS = 5;
export const POPULARITY_RANKED_COUNT = 3;

/**
 * Vitrine « Les plus commandés » en tête de carte et bloc de vente
 * additionnelle du panier : nombre max de produits proposés, et minimum en
 * dessous duquel la vitrine est masquée (une sélection de deux produits
 * ressemble à un bug d'affichage plutôt qu'à un choix).
 */
export const SHOWCASE_MAX_PRODUCTS = 8;
export const SHOWCASE_MIN_PRODUCTS = 3;
export const UPSELL_MAX_PRODUCTS = 6;

/**
 * Carte publique — recherche et navigation par catégories.
 * Source : lib/menu-display.ts + components/(public)/carte/.
 *
 * `SEARCH_MIN_CHARS` : en dessous, la saisie est ignorée et la carte reste
 * complète — une seule lettre ne doit pas vider la page dès la première frappe.
 *
 * Les quatre suivantes cadrent la nav collante de catégories. `SCROLL_OFFSET`
 * est la marge de confort laissée au-dessus d'un titre de section après un clic
 * sur une pilule ; `SCROLL_LOCK_MS` la durée pendant laquelle le scroll-spy
 * s'efface devant ce défilement (sinon les sections traversées volent la
 * sélection au passage) ; `SCROLL_SPY_GAP` et `SCROLL_SPY_BOTTOM_MARGIN` le
 * `rootMargin` de l'IntersectionObserver — la marge haute est calculée à partir
 * de la HAUTEUR MESURÉE de la barre, qui varie avec la barre de recherche.
 */
export const CARTE_SEARCH_MIN_CHARS = 2;

/**
 * Dégradés du repli visuel d'un produit sans photo (`ProductMedia`,
 * components/(public)/carte/_components/product-media.tsx).
 *
 * Quatre variantes plutôt qu'une seule : la majorité du catalogue n'est pas
 * photographiée, et six tuiles rigoureusement identiques côte à côte dans la
 * grille se lisent comme un bug d'affichage plutôt que comme un parti pris.
 * Toutes tirées de la palette de marque (crème, violet, orange doré) pour que
 * la variation reste discrète. Le choix est un hash du `Product.id`, donc
 * stable entre le rendu serveur et le rendu client.
 *
 * Valeurs CSS brutes, appliquées en style inline : une classe Tailwind
 * arbitraire construite à l'exécution (`bg-[${…}]`) ne serait jamais générée,
 * le scanner ne voyant que les chaînes littérales du code source.
 */
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

/**
 * Vitrine éditoriale « Ce qu'on aime vous servir » de l'accueil : plafond
 * distinct de `SHOWCASE_MAX_PRODUCTS` parce que la mise en page diffère — une
 * grille de 3 colonnes, où 8 produits laissent une dernière rangée bancale, là
 * où la vitrine de la carte est une bande qui défile horizontalement.
 * Source : components/(public)/accueil/incontournables-section.tsx.
 */
export const HOME_FEATURED_MAX_PRODUCTS = 6;

/**
 * Répartitions de parts les plus choisies (« Oreo ×2 · Coco ×1 — 34 fois »),
 * proposées en un appui dans le composeur de boîtes. Agrégées sur la même
 * fenêtre que la preuve sociale (`POPULARITY_WINDOW_DAYS`).
 *
 * `MIN_ORDERS` : en dessous, une « combinaison populaire » n'en est pas une et
 * afficher son compteur dessert la suggestion. `MAX` borne l'encombrement de la
 * bande de raccourcis. Source : `lib/portion-combos.ts`.
 */
export const PORTION_COMBO_MIN_ORDERS = 3;
export const PORTION_COMBO_MAX = 3;

/**
 * Commande à l'avance : délai max (jours) qu'un produit ou une catégorie
 * peut exiger avant retrait. Garde-fou anti-faute de frappe — un délai plus
 * long qu'un mois n'a pas de sens pour une carte de coffee shop.
 * Source : lib/menu-mutations.ts (advanceOrderDaysFieldSchema).
 */
export const ADVANCE_ORDER_DAYS_MAX = 30;

/**
 * Horizon minimum (jours) toujours proposé au client dans le sélecteur de
 * créneau du checkout (« Planifier »), quel que soit le réglage
 * `visibleDays` enregistré (`/dashboard/parametres`) — appliqué en lecture
 * dans `/api/pickup-slots`, sans jamais réduire un réglage déjà plus large.
 * Source : lib/pickup-settings.ts (DEFAULT_SETTINGS.visibleDays).
 */
export const PICKUP_MIN_VISIBLE_DAYS = 7;
