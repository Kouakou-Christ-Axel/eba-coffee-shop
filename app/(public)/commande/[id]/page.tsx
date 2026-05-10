// app/(public)/commande/[id]/page.tsx
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle } from 'lucide-react';
import { getOrder } from '@/lib/orders';
import { formatPickupTime } from '@/lib/format-order';
import { priceFormatter } from '@/config/menu';
import type { CartItem } from '@/lib/cart-store';

export const metadata: Metadata = {
  title: 'Commande confirmée — EBA Coffee Shop',
  robots: { index: false, follow: false },
};

type Props = { params: Promise<{ id: string }> };

export default async function CommandePage({ params }: Props) {
  const { id } = await params;
  const order = await getOrder(id);

  if (!order) notFound();

  const items = order.items as unknown as CartItem[];
  const pickupFormatted = formatPickupTime(order.pickupTime);

  return (
    <main className="mx-auto max-w-xl px-4 py-12">
      <div className="flex flex-col items-center gap-6">
        <CheckCircle className="h-16 w-16 text-success" strokeWidth={1.5} />

        <div className="text-center">
          <h1 className="text-2xl font-bold">Commande confirmée&nbsp;!</h1>
          <p className="mt-1 text-sm text-foreground/60">
            Bonjour {order.customerName}, votre commande a bien été enregistrée.
          </p>
        </div>

        <div className="w-full rounded-xl border border-foreground/10 bg-default-50 p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-foreground/40">
            Référence
          </p>
          <p className="mt-1 font-mono text-lg font-bold tracking-wider text-primary">
            {order.reference}
          </p>

          <div className="mt-4 flex flex-col gap-1 text-sm">
            <p>
              <span className="text-foreground/50">Retrait&nbsp;:</span>{' '}
              {pickupFormatted}
            </p>
            <p>
              <span className="text-foreground/50">Téléphone&nbsp;:</span>{' '}
              {order.customerPhone}
            </p>
          </div>
        </div>

        <div className="w-full">
          <h2 className="mb-3 text-sm font-semibold">Articles</h2>
          <div className="flex flex-col gap-2">
            {items.map((item, i) => (
              <div
                key={i}
                className="flex items-start justify-between gap-2 text-sm"
              >
                <div className="min-w-0">
                  <p className="font-medium">
                    {item.productName}{' '}
                    <span className="text-foreground/50">x{item.quantity}</span>
                  </p>
                  {item.supplements.length > 0 && (
                    <p className="text-xs text-foreground/50">
                      {item.supplements.map((s) => s.optionName).join(', ')}
                    </p>
                  )}
                </div>
                <p className="shrink-0 font-medium">
                  {priceFormatter.format(
                    (item.basePrice +
                      item.supplements.reduce((s, sup) => s + sup.price, 0)) *
                      item.quantity
                  )}
                  &nbsp;F
                </p>
              </div>
            ))}
          </div>

          <div className="mt-4 flex justify-between border-t border-foreground/10 pt-4 font-semibold">
            <span>Total</span>
            <span className="text-primary">
              {priceFormatter.format(order.total)}&nbsp;FCFA
            </span>
          </div>
        </div>

        <p className="text-center text-sm text-foreground/60">
          Présentez-vous au comptoir EBA Coffee Shop à l&apos;heure choisie.
          Paiement sur place en espèces ou mobile money.
        </p>

        <Link
          href="/carte"
          className="text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          ← Retour à la carte
        </Link>
      </div>
    </main>
  );
}
