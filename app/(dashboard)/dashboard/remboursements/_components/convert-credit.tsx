'use client';

// Conversion d'un avoir payé en argent rendu au client : la somme est retirée de
// son solde dès la demande, un admin valide ensuite comme tout remboursement.

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  SELECTABLE_PAYMENT_MODES,
  PAYMENT_MODE_LABELS,
} from '@/lib/payment-modes';
import { canTransferVia } from '@/lib/refunds/destination';
import type { PaymentMode } from '@/generated/prisma/client';
import { convertCreditAction } from '../actions';
import type { RefundDetailData } from './refund-types';

const fmt = new Intl.NumberFormat('fr-FR');
const selectClass =
  'h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50';

export function ConvertCredit({
  refund,
  onDone,
}: {
  refund: RefundDetailData;
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(String(refund.convertibleCredit));
  const [channel, setChannel] = useState<PaymentMode>('CASH');
  const [delivery, setDelivery] = useState<'JEKO_TRANSFER' | 'MANUAL'>(
    'MANUAL'
  );
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(
    null
  );
  const [pending, startTransition] = useTransition();
  const transferable = canTransferVia(channel);
  const value = Number(amount) || 0;
  const invalid = value <= 0 || value > refund.convertibleCredit;

  function submit() {
    setMessage(null);
    startTransition(async () => {
      const r = await convertCreditAction({
        sourceRefundId: refund.id,
        amount: value,
        channel,
        delivery: transferable ? delivery : 'MANUAL',
        destinationPhone: phone.trim() || undefined,
      });
      if (r.ok) {
        setOpen(false);
        setMessage({ ok: true, text: r.message ?? 'Demande envoyée.' });
        onDone();
      } else {
        setMessage({ ok: false, text: r.error });
      }
    });
  }

  if (!open) {
    return (
      <div className="space-y-2">
        <Button variant="outline" onClick={() => setOpen(true)}>
          Convertir l’avoir en argent ({fmt.format(refund.convertibleCredit)} F)
        </Button>
        {message && (
          <p
            role="status"
            className={`text-sm ${message.ok ? 'text-green-600' : 'text-destructive'}`}
          >
            {message.text}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border p-3">
      <p className="text-sm font-semibold">Convertir l’avoir en argent</p>
      <p className="text-xs text-muted-foreground">
        La somme est retirée du solde du client tout de suite ; elle lui revient
        si la demande est refusée ou annulée.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="cv-amount">Montant (F)</Label>
          <Input
            id="cv-amount"
            type="number"
            min={1}
            max={refund.convertibleCredit}
            inputMode="numeric"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cv-channel">Rendu par</Label>
          <select
            id="cv-channel"
            className={selectClass}
            value={channel}
            onChange={(e) => {
              const next = e.target.value as PaymentMode;
              setChannel(next);
              if (!canTransferVia(next)) setDelivery('MANUAL');
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
          <Label htmlFor="cv-delivery">Envoi</Label>
          <select
            id="cv-delivery"
            className={selectClass}
            value={transferable ? delivery : 'MANUAL'}
            disabled={!transferable}
            onChange={(e) =>
              setDelivery(e.target.value as 'JEKO_TRANSFER' | 'MANUAL')
            }
          >
            <option value="JEKO_TRANSFER">Transfert Jèko</option>
            <option value="MANUAL">Remise à la main</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cv-phone">Numéro (facultatif)</Label>
          <Input
            id="cv-phone"
            type="tel"
            inputMode="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>
      </div>
      {message && !message.ok && (
        <p role="alert" className="text-sm text-destructive">
          {message.text}
        </p>
      )}
      <div className="flex gap-2">
        <Button disabled={pending || invalid} onClick={submit}>
          Envoyer la demande
        </Button>
        <Button
          variant="ghost"
          disabled={pending}
          onClick={() => setOpen(false)}
        >
          Annuler
        </Button>
      </div>
    </div>
  );
}
