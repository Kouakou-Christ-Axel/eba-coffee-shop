// Mutations du menu (catégories, produits, stock, plannings). Implémentation dans `lib/menu/mutations/`.

export { slugify } from './menu/mutations/helpers';
export {
  createCategorySchema,
  updateCategorySchema,
  productInputSchema,
  productUpdateSchema,
} from './menu/mutations/schemas';
export type {
  CategoryInput,
  CategoryUpdate,
  ProductInput,
  ProductUpdate,
} from './menu/mutations/schemas';
export {
  createCategory,
  updateCategory,
  deleteCategory,
  toggleCategoryAvailability,
  moveCategory,
  reorderCategories,
} from './menu/mutations/categories';
export {
  createProduct,
  updateProduct,
  moveProduct,
  reorderProducts,
  deleteProduct,
  toggleProductAvailability,
  setProductAvailability,
  toggleProductFeatured,
} from './menu/mutations/products';
export {
  bulkUpdateProducts,
  bulkUpdateProductsSchema,
  bulkSetProductStockSchema,
} from './menu/mutations/bulk';
export type {
  BulkUpdateProductsInput,
  BulkSetProductStockInput,
} from './menu/mutations/bulk';
export {
  pauseProduct,
  resumeProduct,
  productScheduleSchema,
  productScheduleUpdateSchema,
  createProductSchedule,
  updateProductSchedule,
  deleteProductSchedule,
} from './menu/mutations/schedules';
export type {
  ProductScheduleInput,
  ProductScheduleUpdateInput,
} from './menu/mutations/schedules';
export {
  productWeeklySpecialSchema,
  productWeeklySpecialUpdateSchema,
  createProductWeeklySpecial,
  updateProductWeeklySpecial,
  deleteProductWeeklySpecial,
} from './menu/mutations/weekly-specials';
export type {
  ProductWeeklySpecialInput,
  ProductWeeklySpecialUpdateInput,
} from './menu/mutations/weekly-specials';

// Écritures de STOCK : exportées enveloppées par `revalidatesPublicMenu`
// (lib/revalidate-public-menu.ts), qui invalide la carte publique une fois
// l'écriture terminée — les appelants (actions, routes, MCP) n'ont plus à le
// faire pour le stock.
import { revalidatesPublicMenu } from './revalidate-public-menu';
import {
  setProductStock as setProductStockImpl,
  setOptionStock as setOptionStockImpl,
  restockProduct as restockProductImpl,
  restockOption as restockOptionImpl,
  setOptionStockByRef as setOptionStockByRefImpl,
  setProductStockById as setProductStockByIdImpl,
} from './menu/mutations/stock';
import { bulkSetProductStock as bulkSetProductStockImpl } from './menu/mutations/bulk';

export const setProductStock = revalidatesPublicMenu(setProductStockImpl);
export const setOptionStock = revalidatesPublicMenu(setOptionStockImpl);
export const restockProduct = revalidatesPublicMenu(restockProductImpl);
export const restockOption = revalidatesPublicMenu(restockOptionImpl);
export const setOptionStockByRef = revalidatesPublicMenu(
  setOptionStockByRefImpl
);
export const setProductStockById = revalidatesPublicMenu(
  setProductStockByIdImpl
);
export const bulkSetProductStock = revalidatesPublicMenu(
  bulkSetProductStockImpl
);
