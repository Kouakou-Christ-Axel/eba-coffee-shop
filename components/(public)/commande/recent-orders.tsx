'use client';

// components/(public)/commande/recent-orders.tsx
//
// Liste des commandes passées depuis CET appareil (lib/order-history.ts,
// localStorage — sans compte). Chaque entrée renvoie vers sa page de suivi
// /commande/:id, l'URL « capability » qu'on ne montrait qu'une fois avant.

import { useSyncExternalStore } from 'react';
import Link from 'next/link';
import { Button } from '@heroui/react';
import { ChevronRight, Receipt, Trash2 } from 'lucide-react';
import {
  clearOrderHistory,
  getOrderHistoryServerSnapshot,
  ORDER_HISTORY_HYDRATING,
  readOrderHistory,
  subscribeOrderHistory,
} from '@/lib/order-history';
import { getPickupCode } from '@/lib/orders/format';
import { priceFormatter } from '@/config/menu';

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

export function RecentOrders() {
  // Store externe : lecture localStorage sans setState-dans-effet ni mismatch
  // d'hydratation (le snapshot serveur est un sentinel → rendu null).
  const orders = useSyncExternalStore(
    subscribeOrderHistory,
    readOrderHistory,
    getOrderHistoryServerSnapshot
  );

  if (orders === ORDER_HISTORY_HYDRATING) return null;

  if (orders.length === 0) {
    return (
      <div className="rounded-xl border border-foreground/10 bg-default-50 p-8 text-center">
        <Receipt className="mx-auto h-8 w-8 text-foreground/30" />
        <p className="mt-3 text-sm text-foreground/60">
          Tes commandes passées sur cet appareil apparaîtront ici.
        </p>
        <Button
          as={Link}
          href="/carte"
          color="primary"
          size="sm"
          className="mt-4"
        >
          Voir la carte
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        {orders.map((order) => (
          <Link
            key={order.id}
            href={`/commande/${order.id}`}
            className="group flex items-center justify-between gap-3 rounded-xl border border-foreground/10 bg-default-50 p-4 transition-colors hover:border-primary/40"
          >
            <div className="min-w-0">
              <p className="text-sm font-semibold capitalize">
                {formatDate(order.createdAt)}
              </p>
              <p className="mt-0.5 text-xs text-foreground/50">
                Code de retrait{' '}
                <span className="font-mono font-semibold text-foreground/70">
                  {getPickupCode(order.reference)}
                </span>{' '}
                · {priceFormatter.format(order.total)}&nbsp;F
              </p>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-foreground/30 transition-colors group-hover:text-primary" />
          </Link>
        ))}
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-foreground/40">
          Historique conservé sur cet appareil uniquement.
        </p>
        <Button
          variant="light"
          size="sm"
          startContent={<Trash2 className="h-3.5 w-3.5" />}
          onPress={clearOrderHistory}
        >
          Effacer
        </Button>
      </div>
    </div>
  );
}
