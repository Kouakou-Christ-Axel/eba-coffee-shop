// emails/inventory-reminder.tsx
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

export type InventoryReminderItem = {
  name: string;
  quantity: number;
  unit: string;
};

type Props = {
  daysSince: number;
  lowStockItems: InventoryReminderItem[];
};

const qtyFormatter = new Intl.NumberFormat('fr-FR', {
  maximumFractionDigits: 3,
});

export default function InventoryReminderEmail({
  daysSince,
  lowStockItems,
}: Props) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? '';
  return (
    <Html lang="fr">
      <Body style={{ fontFamily: 'sans-serif', color: '#333' }}>
        <Container
          style={{ maxWidth: '600px', margin: '0 auto', padding: '24px' }}
        >
          <Heading as="h1">📦 Inventaire à mettre à jour</Heading>

          <Text>
            Le dernier inventaire physique date de <strong>{daysSince}</strong>{' '}
            jour{daysSince > 1 ? 's' : ''}. Pensez à enregistrer un comptage
            pour garder un suivi de stock et une consommation fiables.
          </Text>

          {lowStockItems.length > 0 && (
            <>
              <Hr />
              <Heading as="h2">Références sous le seuil</Heading>
              {lowStockItems.map((item) => (
                <Text key={item.name}>
                  {item.name} — {qtyFormatter.format(item.quantity)} {item.unit}
                </Text>
              ))}
            </>
          )}

          <Hr />

          <Link href={`${siteUrl}/dashboard/inventaire`}>
            Ouvrir l’inventaire dans le dashboard →
          </Link>
        </Container>
      </Body>
    </Html>
  );
}
