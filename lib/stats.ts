// Stats agrégées de la vue d'ensemble admin (jour civil local Abidjan). Implémentation dans `lib/stats/`.

export { getDailyStats } from './stats/daily';
export type { DailyStats } from './stats/daily';
export {
  getRangeStats,
  getEarliestOrderDate,
  ORDER_STATUSES,
} from './stats/range';
export type { RangeStats } from './stats/range';
export { getDailySeries } from './stats/series';
export type { DailyPoint } from './stats/series';
export { getTopProducts } from './stats/products';
export type { TopProduct } from './stats/products';
