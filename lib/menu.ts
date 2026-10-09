// Lecture du menu (public et admin). Implémentation dans `lib/menu/queries/`.

export { intersectAvailableDays } from './menu/queries/helpers';
export { getMenu } from './menu/queries/public';
export { getMenuAdmin } from './menu/queries/admin';
export type {
  AdminMenuSupplementOption,
  AdminMenuSupplementGroup,
  AdminMenuWeeklySpecial,
  AdminMenuProduct,
  AdminMenuCategory,
} from './menu/queries/admin';
export { getGlobalExtras } from './menu/queries/extras';
export type {
  GlobalExtraOption,
  GlobalExtraGroup,
} from './menu/queries/extras';
export { getAllOptionStock } from './menu/queries/stock';
export type { OptionStockRow } from './menu/queries/stock';
export {
  listProductSchedules,
  listProductWeeklySpecials,
} from './menu/queries/schedules';
export type {
  ProductScheduleRow,
  ProductWeeklySpecialRow,
} from './menu/queries/schedules';
