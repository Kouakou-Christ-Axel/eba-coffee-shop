import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MissedOrderStampsSheet } from '../../missed-order-stamps-form';
import { priceFmt } from './helpers';
import type { LoyaltyCard } from './types';

export function LoyaltyCardPanel({
  card,
  customerId,
}: {
  card: NonNullable<LoyaltyCard>;
  customerId: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle className="text-base">Carte de fidélité</CardTitle>
        <MissedOrderStampsSheet customerId={customerId} />
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-3">
          <span className="text-2xl font-bold tabular-nums">
            {card.stampCount}/{card.settings.stampsPerCard}
          </span>
          <span className="text-sm text-muted-foreground">
            tampons sur la carte en cours
          </span>
        </div>
        {card.availableRewards.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {card.availableRewards.map((r) => (
              <Badge key={r.id} className="bg-green-600">
                🎁 Récompense dispo — jusqu&apos;à{' '}
                {priceFmt.format(r.capAmount)} F
              </Badge>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Aucune récompense en attente.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
