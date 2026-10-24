// Lecture des clients (CRM), stats calculées à la volée. Implémentation dans `lib/customers/`.

export type {
  CustomerStats,
  CustomerListSummary,
  CustomerSortKey,
  SortDir,
  CustomerDetailStats,
} from './customers/types';
export { listCustomers } from './customers/list';
export { getCustomer, getCustomerByPhone } from './customers/detail';
export { getCustomerListSummary } from './customers/summary';
