import { Bot } from 'lucide-react';
import { type OrderStatus } from '@/generated/prisma/client';
import { Badge } from '@/components/ui/badge';

const STATUS_LABELS: Record<OrderStatus, string> = {
  NEW: 'Nouvelle',
  PREPARING: 'En cours',
  READY: 'Prête',
  COMPLETED: 'Récupérée',
  CANCELLED: 'Annulée',
};

const STATUS_VARIANTS: Record<
  OrderStatus,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  NEW: 'secondary',
  PREPARING: 'default',
  READY: 'default',
  COMPLETED: 'outline',
  CANCELLED: 'destructive',
};

// READY sur-coloré en vert : « En cours » et « Prête » partageaient la même variante.
const STATUS_EXTRA_CLASS: Partial<Record<OrderStatus, string>> = {
  READY: 'bg-green-600 hover:bg-green-600/90',
};

export function PaymentBadge({
  isPaid,
  status,
  paymentMode,
  autoValidatedByAi,
}: {
  isPaid: boolean;
  status: OrderStatus;
  paymentMode: string | null;
  autoValidatedByAi: boolean;
}) {
  if (isPaid) {
    return (
      <Badge
        variant="default"
        className="inline-flex items-center gap-1 bg-green-600"
      >
        {paymentMode ?? 'Fractionné'}
        {autoValidatedByAi && (
          <span title="Encaissement automatique (IA)">
            <Bot className="h-3 w-3" aria-hidden="true" />
          </span>
        )}
      </Badge>
    );
  }
  if (status !== 'CANCELLED')
    return <Badge variant="secondary">À encaisser</Badge>;
  return <Badge variant="outline">—</Badge>;
}

export function StatusBadge({ status }: { status: OrderStatus }) {
  return (
    <Badge
      variant={STATUS_VARIANTS[status]}
      className={STATUS_EXTRA_CLASS[status]}
    >
      {STATUS_LABELS[status]}
    </Badge>
  );
}
