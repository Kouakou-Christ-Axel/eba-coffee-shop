// emails/new-order.tsx
import * as React from 'react';
import {
  Html,
  Body,
  Container,
  Heading,
  Text,
  Link,
  Hr,
} from '@react-email/components';
import { formatPickupTime } from '@/lib/format-order';
import type { CartItem } from '@/lib/cart-store';

type OrderData = {
  id: string;
  reference: string;
  customerName: string | null;
  customerPhone: string | null;
  pickupTime: Date | null;
  items: CartItem[];
  total: number;
};

type Props = { order: OrderData };

const priceFormatter = new Intl.NumberFormat('fr-FR');

export default function NewOrderEmail({ order }: Props) {
  const items = order.items;
  const pickupFormatted = order.pickupTime
    ? formatPickupTime(order.pickupTime)
    : 'Walk-in (sans créneau)';
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? '';

  return (
    <Html lang="fr">
      <Body style={{ fontFamily: 'sans-serif', color: '#333' }}>
        <Container
          style={{ maxWidth: '600px', margin: '0 auto', padding: '24px' }}
        >
          <Heading as="h1">🛎️ Nouvelle commande EBA Coffee Shop</Heading>

          <Text>
            <strong>Référence :</strong> {order.reference}
          </Text>
          <Text>
            <strong>Retrait :</strong> {pickupFormatted}
          </Text>

          <Hr />

          <Heading as="h2">Client</Heading>
          <Text>
            <strong>Prénom :</strong> {order.customerName ?? 'Anonyme'}
          </Text>
          <Text>
            <strong>Téléphone :</strong> {order.customerPhone ?? '—'}
          </Text>

          <Hr />

          <Heading as="h2">Articles</Heading>
          {items.map((item) => {
            const supplementsTotal = item.supplements.reduce(
              (sum, s) => sum + s.price,
              0
            );
            const lineTotal =
              (item.basePrice + supplementsTotal) * item.quantity;
            return (
              <Text key={item.cartId}>
                {item.productName} x{item.quantity} —{' '}
                {priceFormatter.format(lineTotal)} FCFA
                {item.supplements.length > 0 && (
                  <>
                    {'\n'}
                    <span style={{ color: '#666', fontSize: '0.9em' }}>
                      {item.supplements
                        .map(
                          (s) =>
                            `${s.optionName} (+${priceFormatter.format(s.price)} FCFA)`
                        )
                        .join(', ')}
                    </span>
                  </>
                )}
              </Text>
            );
          })}
          <Text>
            <strong>Total : {priceFormatter.format(order.total)} FCFA</strong>
          </Text>

          <Hr />

          <Link href={`${siteUrl}/dashboard/commandes/${order.id}`}>
            Voir la commande dans le dashboard →
          </Link>
        </Container>
      </Body>
    </Html>
  );
}
