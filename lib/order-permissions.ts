import type { OrderStatus, UserRole } from '@/generated/prisma/client';

type Transition = {
  from: OrderStatus;
  to: OrderStatus;
  roles: UserRole[];
};

const CASHIER_PLUS: UserRole[] = [
  'ADMIN',
  'MANAGER',
  'ASSISTANT_MANAGER',
  'CASHIER',
];
const KITCHEN_PLUS: UserRole[] = [
  'ADMIN',
  'MANAGER',
  'ASSISTANT_MANAGER',
  'CASHIER',
  'KITCHEN',
];

const TRANSITIONS: readonly Transition[] = [
  { from: 'NEW', to: 'PREPARING', roles: KITCHEN_PLUS },
  { from: 'PREPARING', to: 'READY', roles: KITCHEN_PLUS },
  { from: 'READY', to: 'COMPLETED', roles: CASHIER_PLUS },

  // Annulations / remboursements : tout caissier peut annuler une commande
  // active. Annuler une commande déjà payée vaut remboursement.
  { from: 'NEW', to: 'CANCELLED', roles: CASHIER_PLUS },
  { from: 'PREPARING', to: 'CANCELLED', roles: CASHIER_PLUS },
  { from: 'READY', to: 'CANCELLED', roles: CASHIER_PLUS },
  { from: 'COMPLETED', to: 'CANCELLED', roles: CASHIER_PLUS },
];

/** Vérifie si un rôle peut faire passer une commande d'un statut à un autre. */
export function canTransition(
  from: OrderStatus,
  to: OrderStatus,
  role: UserRole
): boolean {
  return TRANSITIONS.some(
    (t) => t.from === from && t.to === to && t.roles.includes(role)
  );
}

/** Liste les statuts cible accessibles depuis `from` pour un rôle. */
export function nextStatuses(from: OrderStatus, role: UserRole): OrderStatus[] {
  return TRANSITIONS.filter(
    (t) => t.from === from && t.roles.includes(role)
  ).map((t) => t.to);
}

/** Le rôle peut-il toggle le flag `isPaid` ? */
export function canTogglePayment(role: UserRole): boolean {
  return CASHIER_PLUS.includes(role);
}

/** Le rôle peut-il signaler "demander livreur" ? */
export function canRequestDriver(role: UserRole): boolean {
  return KITCHEN_PLUS.includes(role);
}

/** Le rôle peut-il dismiss le signal "demander livreur" ? */
export function canDismissDriverRequest(role: UserRole): boolean {
  return CASHIER_PLUS.includes(role);
}
