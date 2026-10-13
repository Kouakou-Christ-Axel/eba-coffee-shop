export type {
  SupplementOption,
  SupplementGroup,
  Product,
  PortionCombo,
  MenuCategory,
} from './menu-types';
export { menu } from './menu-data';

export const priceFormatter = new Intl.NumberFormat('fr-FR');
