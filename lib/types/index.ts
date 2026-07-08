// lib/types/index.ts
//
// Point d'entrée unique pour les types métier partagés. On re-exporte depuis
// les fichiers de schéma (Zod-derived) et depuis les modules existants pour
// éviter la duplication. Les types déjà bien localisés ailleurs ne sont PAS
// redéfinis ici — uniquement re-exportés pour offrir une surface unique.

// ─── Order (création + mise à jour) ───────────────────────────────────────────

export type {
  CartItemSupplementInput,
  CartItemInput,
  CreateOrderInput,
  UpdateOrderInput,
  OrderStatusInput,
  OrderTypeInput,
  PaymentModeInput,
} from '@/lib/schemas/order';

export {
  cartItemSupplementSchema,
  cartItemSchema,
  createOrderSchema,
  updateOrderSchema,
  orderStatusSchema,
  orderTypeSchema,
  paymentModeSchema,
} from '@/lib/schemas/order';

// ─── Menu (catégories, produits, suppléments) ─────────────────────────────────

export type {
  SupplementOptionInput,
  SupplementGroupInput,
  MenuItemInput,
  MenuCategoryInput,
  MenuInput,
} from '@/lib/schemas/menu';

export {
  supplementOptionSchema,
  supplementGroupSchema,
  menuItemSchema,
  menuCategorySchema,
  menuSchema,
} from '@/lib/schemas/menu';

// ─── Upload ───────────────────────────────────────────────────────────────────

export type {
  AllowedImageMimeType,
  UploadFileInput,
  ImageUrlInput,
} from '@/lib/schemas/upload';

export {
  ALLOWED_IMAGE_MIME_TYPES,
  MAX_UPLOAD_SIZE_BYTES,
  uploadFileSchema,
  imageUrlSchema,
  imageExtensionFromMime,
  isAllowedImageMimeType,
} from '@/lib/schemas/upload';

// ─── Cart (store client Zustand) ──────────────────────────────────────────────
// Déjà bien localisé dans lib/cart-store.ts — on re-exporte uniquement.

export type { CartItem, CartItemSupplement } from '@/lib/cart-store';

// ─── Auth helpers (session staff + permissions) ───────────────────────────────
// Déjà bien localisés dans lib/auth-helpers.ts et lib/order-permissions.ts.

export type { AuthorizedSession } from '@/lib/auth-helpers';
export { ROLE_GROUPS } from '@/lib/auth-helpers';

// ─── Menu de production (config statique) ─────────────────────────────────────
// Types historiques utilisés partout dans l'app — on les re-exporte pour offrir
// une porte d'entrée unifiée. Les définitions canoniques restent dans
// config/menu.ts.

export type {
  SupplementOption,
  SupplementGroup,
  Product,
  MenuCategory,
} from '@/config/menu';

// ─── Inventaire ───────────────────────────────────────────────────────────────

export type {
  InventoryUnitInput,
  InventoryItemInput,
  InventoryItemUpdateInput,
  InventoryPurchaseLineInput,
  BatchRestockInput,
  BatchCountInput,
  InventoryImportRowInput,
  InventoryImportMode,
  InventoryFiltersInput,
} from '@/lib/schemas/inventory';

export {
  inventoryUnitSchema,
  inventoryItemObjectSchema,
  inventoryItemInputSchema,
  inventoryItemUpdateSchema,
  inventoryPurchaseLineSchema,
  batchRestockSchema,
  batchCountSchema,
  inventoryImportRowSchema,
  inventoryImportModeSchema,
  inventoryFiltersSchema,
} from '@/lib/schemas/inventory';

export type { InventorySettings } from '@/lib/inventory-settings';
export { inventorySettingsSchema } from '@/lib/inventory-settings';

// ─── Sondages ───────────────────────────────────────────────────────────────────

export type {
  PollStatusInput,
  PollResultsVisibilityInput,
  PollSuggestionStatusInput,
  PollOptionInput,
  PollOptionUpdateInput,
  PollInput,
  PollUpdateInput,
  PollStatusUpdateInput,
  PollFiltersInput,
  PollSuggestionSubmitInput,
  PollSuggestionModerationInput,
  CastVoteInput,
} from '@/lib/schemas/poll';

export {
  pollStatusSchema,
  pollResultsVisibilitySchema,
  pollSuggestionStatusSchema,
  pollOptionInputSchema,
  pollOptionUpdateSchema,
  pollInputSchema,
  pollUpdateSchema,
  pollStatusUpdateSchema,
  pollFiltersSchema,
  pollSuggestionSubmitSchema,
  pollSuggestionModerationSchema,
  castVoteSchema,
} from '@/lib/schemas/poll';
