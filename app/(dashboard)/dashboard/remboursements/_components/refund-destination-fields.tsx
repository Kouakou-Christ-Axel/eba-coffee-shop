'use client';

// Canal, mode d'envoi et numéro d'un remboursement en argent (demande depuis une
// commande). Extrait de `request-refund-sheet.tsx` pour garder le fichier court.

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  SELECTABLE_PAYMENT_MODES,
  PAYMENT_MODE_LABELS,
} from '@/lib/payment-modes';
import { canTransferVia } from '@/lib/refunds/destination';
import type { PaymentMode } from '@/generated/prisma/client';

const selectClass =
  'h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50';

type Delivery = 'JEKO_TRANSFER' | 'MANUAL';

export function RefundDestinationFields({
  channel,
  onChannel,
  delivery,
  onDelivery,
  phone,
  onPhone,
}: {
  channel: PaymentMode;
  onChannel: (m: PaymentMode) => void;
  delivery: Delivery;
  onDelivery: (d: Delivery) => void;
  phone: string;
  onPhone: (p: string) => void;
}) {
  const transferable = canTransferVia(channel);
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="rq-channel">Rendu par</Label>
          <select
            id="rq-channel"
            className={selectClass}
            value={channel}
            onChange={(e) => {
              const next = e.target.value as PaymentMode;
              onChannel(next);
              if (!canTransferVia(next)) onDelivery('MANUAL');
            }}
          >
            {SELECTABLE_PAYMENT_MODES.map((m) => (
              <option key={m} value={m}>
                {PAYMENT_MODE_LABELS[m]}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="rq-delivery">Envoi</Label>
          <select
            id="rq-delivery"
            className={selectClass}
            value={transferable ? delivery : 'MANUAL'}
            disabled={!transferable}
            onChange={(e) => onDelivery(e.target.value as Delivery)}
          >
            <option value="JEKO_TRANSFER">Transfert Jèko</option>
            <option value="MANUAL">Remise à la main</option>
          </select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="rq-phone">
          Numéro du client{' '}
          {(transferable ? delivery : 'MANUAL') === 'JEKO_TRANSFER'
            ? '(reçoit le transfert)'
            : '(facultatif)'}
        </Label>
        <Input
          id="rq-phone"
          type="tel"
          inputMode="tel"
          value={phone}
          onChange={(e) => onPhone(e.target.value)}
        />
      </div>
    </>
  );
}
