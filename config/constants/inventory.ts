/** Péremption du brouillon de comptage d'inventaire (lib/hooks/use-inventory-count.ts). */
export const INVENTORY_COUNT_DRAFT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/** Inventaire (matières premières & consommables). */
export const INVENTORY_SKU_MAX = 40;

export const INVENTORY_NAME_MAX = 100;

export const INVENTORY_CATEGORY_MAX = 50;

export const INVENTORY_SUPPLIER_MAX = 100;

export const INVENTORY_NOTE_MAX = 500;

export const INVENTORY_QUANTITY_MAX = 1_000_000;

export const INVENTORY_UNIT_COST_MAX = 100_000_000;

export const INVENTORY_IMPORT_MAX_ROWS = 1000;

/** Seuil de stock bas (produit ou option) déclenchant l'affichage « Plus que N » côté carte publique, au lieu d'un simple compteur non alarmant. */
export const LOW_STOCK_THRESHOLD = 5;

export const RESTOCK_ALERT_TTL_DAYS = 7;

export const RESTOCK_ALERT_MAX_PER_ENDPOINT = 20;
