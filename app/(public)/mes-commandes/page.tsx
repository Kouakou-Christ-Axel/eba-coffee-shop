// app/(public)/mes-commandes/page.tsx
//
// « Mes commandes » sans compte : l'historique vit dans le localStorage de
// l'appareil (lib/order-history.ts), écrit à chaque soumission de commande.
// Page noindex : contenu propre à chaque appareil, rien à référencer.

import type { Metadata } from 'next';
import Link from 'next/link';
import { RecentOrders } from '@/components/(public)/commande/recent-orders';

export const metadata: Metadata = {
  title: 'Mes commandes — EBA Coffee Shop',
  robots: { index: false, follow: false },
};

export default function MesCommandesPage() {
  return (
    <div className="mx-auto max-w-xl px-4 pb-12 pt-28 sm:pt-32">
      <h1 className="text-2xl font-bold">Mes commandes</h1>
      <p className="mt-1 text-sm text-foreground/60">
        Retrouve ici les commandes passées depuis cet appareil et suis-les en
        direct.
      </p>

      <div className="mt-6">
        <RecentOrders />
      </div>

      <div className="mt-8 text-center">
        <Link
          href="/carte"
          className="text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          ← Retour à la carte
        </Link>
      </div>
    </div>
  );
}
