// config/constants.ts
//
// Constantes numériques partagées (nombres "magiques" historiquement dispersés
// dans le code). Chaque entrée référence sa provenance pour faciliter la
// suppression du doublon dans la vague d'intégration suivante.

/**
 * Taille maximale d'un upload d'image en octets (5 MB).
 * Source : app/api/upload/route.ts (MAX_BYTES).
 */
export const MAX_UPLOAD_SIZE_BYTES = 5 * 1024 * 1024;

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
 * Remise caisse : une remise (montant fixe en FCFA) appliquée à une ligne
 * d'article ne peut pas dépasser cette fraction du prix brut de la ligne.
 * Plafond métier validé côté client ET serveur.
 */
export const MAX_LINE_DISCOUNT_RATIO = 0.5;

/** Longueur max du motif de remise saisi par le caissier. */
export const ORDER_DISCOUNT_REASON_MAX = 100;

/**
 * Suivi des dépenses (back-office). Longueurs max des champs de saisie et
 * plafond de montant (garde-fou anti-faute de frappe, en francs CFA).
 */
export const EXPENSE_CATEGORY_NAME_MAX = 50;
export const EXPENSE_SUPPLIER_MAX = 100;
export const EXPENSE_NOTE_MAX = 500;
export const EXPENSE_AMOUNT_MAX = 100_000_000;

/**
 * Investissements (apports / financements). Longueurs max des champs et plafond
 * de montant. Le plafond est plus élevé que celui des dépenses : un apport en
 * capital ou un prêt peut représenter une somme importante (en francs CFA).
 */
export const INVESTMENT_SOURCE_NAME_MAX = 50;
export const INVESTMENT_FINANCIER_MAX = 100;
export const INVESTMENT_NOTE_MAX = 500;
export const INVESTMENT_AMOUNT_MAX = 1_000_000_000;
