import type { OrderStatus, OrderType } from '@/generated/prisma/client';
import { formatAbidjanDateTime } from '@/lib/timezone';
import type { getOrder } from '@/lib/orders';

export type OrderDetail = NonNullable<Awaited<ReturnType<typeof getOrder>>>;

export const STATUS_LABELS: Record<OrderStatus, string> = {
  NEW: 'Nouvelle',
  PREPARING: 'En cours',
  READY: 'Prête',
  COMPLETED: 'Récupérée',
  CANCELLED: 'Annulée',
};

export const STATUS_VARIANTS: Record<
  OrderStatus,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  NEW: 'secondary',
  PREPARING: 'default',
  READY: 'default',
  COMPLETED: 'outline',
  CANCELLED: 'destructive',
};

export const ORDER_TYPE_LABELS: Record<OrderType, string> = {
  TAKEAWAY: 'À emporter',
  DINE_IN: 'Sur place',
  DELIVERY: 'Livraison',
};

export function formatPickupTime(date: Date | null): string {
  // Toujours en heure Abidjan : déterministe quel que soit le fuseau du serveur.
  if (!date) return 'Sans créneau (walk-in)';
  return formatAbidjanDateTime(date);
}
