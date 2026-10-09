import type { UserRole } from '@/generated/prisma/client';

/** Rôles ayant accès au dashboard. Fichier pur (import de type seulement) : utilisable côté client. */
export const DASHBOARD_ROLES: UserRole[] = [
  'ADMIN',
  'MANAGER',
  'ASSISTANT_MANAGER',
  'CASHIER',
  'KITCHEN',
  'COMPTABLE',
  'ANALYSTE',
];

/** Rôles autorisés à CONSULTER les commandes (`/dashboard/commandes` et son détail). */
export const ORDERS_VIEW_ROLES: UserRole[] = [
  'ADMIN',
  'MANAGER',
  'ASSISTANT_MANAGER',
  'CASHIER',
  'ANALYSTE',
];
