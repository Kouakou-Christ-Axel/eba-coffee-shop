// config/constants.ts
//
// Constantes numériques partagées (nombres "magiques" historiquement dispersés
// dans le code). Chaque entrée référence sa provenance pour faciliter la
// suppression du doublon dans la vague d'intégration suivante.

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
 * Longueurs max des champs de saisie commande.
 * Source : schémas Zod existants (createOrderSchema, route caisse).
 */
export const ORDER_CUSTOMER_NAME_MAX = 50;
export const ORDER_CUSTOMER_PHONE_MAX = 30;
export const ORDER_NOTE_MAX = 500;

/**
 * Page publique de suivi de commande (/commande/:id) : intervalle de
 * rafraîchissement du statut (polling léger, le SSE reste réservé au staff).
 */
export const ORDER_TRACKING_POLL_INTERVAL_MS = 15_000;

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
 * Suivi des dépenses (back-office). Longueurs max des champs de saisie et
 * plafond de montant (garde-fou anti-faute de frappe, en francs CFA).
 */
export const EXPENSE_CATEGORY_NAME_MAX = 50;
export const EXPENSE_SUPPLIER_MAX = 100;
export const EXPENSE_NOTE_MAX = 500;
export const EXPENSE_AMOUNT_MAX = 100_000_000;
/** Libellé d'un modèle de dépense récurrente (ex. « Loyer »). */
export const EXPENSE_RECURRING_LABEL_MAX = 50;

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
