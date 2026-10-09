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
  toggleProductFeatured,
} from './menu/mutations/products';
export {
  setProductStock,
  setOptionStock,
  restockProduct,
  restockOption,
  setOptionStockByRef,
  setProductStockById,
} from './menu/mutations/stock';
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
