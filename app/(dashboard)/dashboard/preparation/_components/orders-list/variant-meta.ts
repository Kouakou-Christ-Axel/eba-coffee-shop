import { CalendarClock, PackageCheck, Wallet } from 'lucide-react';
import type { OrdersListVariant } from './types';

export const VARIANT_META: Record<
  OrdersListVariant,
  { title: string; description: string; Icon: typeof CalendarClock }
> = {
  scheduled: {
    title: 'Commandes programmées',
    description: 'Retrait à venir — lancer la préparation le moment venu',
    Icon: CalendarClock,
  },
  ready: {
    title: 'Prêtes à récupérer',
    description: 'Emballer et remettre au client (code de retrait)',
    Icon: PackageCheck,
  },
  topay: {
    title: 'Commandes à encaisser',
    description: 'Ardoise — collecter le paiement maintenant',
    Icon: Wallet,
  },
};
