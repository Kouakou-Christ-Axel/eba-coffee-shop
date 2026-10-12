import { Bike, Coffee, ShoppingBag, Globe, Bot } from 'lucide-react';
import { type OrderSource, type OrderType } from '@/generated/prisma/client';

export const TYPE_ICONS: Record<OrderType, typeof Bike> = {
  DELIVERY: Bike,
  DINE_IN: Coffee,
  TAKEAWAY: ShoppingBag,
};

export const TYPE_LABELS: Record<OrderType, string> = {
  DELIVERY: 'Livraison',
  DINE_IN: 'Sur place',
  TAKEAWAY: 'À emporter',
};

// Origine de création : CASHIER (cas courant) n'affiche rien ; ONLINE/MCP se distinguent d'un badge.
export const SOURCE_META: Partial<
  Record<OrderSource, { label: string; title: string; Icon: typeof Globe }>
> = {
  ONLINE: {
    label: 'En ligne',
    title: 'Commande passée par le client sur le site',
    Icon: Globe,
  },
  MCP: {
    label: 'MCP',
    title: 'Commande saisie via l’outil MCP (rétroactive)',
    Icon: Bot,
  },
};

export function formatPickupTime(date: Date | null): string {
  if (!date) return '—';
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
    .format(date)
    .replace(':', 'h');
}
