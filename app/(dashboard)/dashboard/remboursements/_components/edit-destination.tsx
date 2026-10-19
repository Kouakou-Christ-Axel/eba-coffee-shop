'use client';

// Corriger le canal, le mode d'envoi ou le numéro d'un remboursement (échec dû à
// un mauvais numéro ou au mauvais moyen). Toute correction repasse en « À valider ».

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PAYMENT_MODES, PAYMENT_MODE_LABELS } from '@/lib/payment-modes';
import { REFUND_DELIVERY_LABELS } from '@/lib/refunds/labels';
import {
  updateRefundDestinationAction,
  type RefundActionResult,
} from '../actions';
import type { RefundDetailData } from './refund-types';

const selectClass =
  'h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50';

export function EditDestination({
  refund,
  disabled,
  editableHint,
  onDone,
}: {
  refund: RefundDetailData;
  disabled: boolean;
  editableHint?: string;
  onDone: (result: RefundActionResult) => void;
}) {
  const [open, setOpen] = useState(false);
  const [channel, setChannel] = useState<string>(refund.channel);
  const [delivery, setDelivery] = useState<string>(refund.delivery);
  const [phone, setPhone] = useState('');
  const [pending, startTransition] = useTransition();

  if (!open) {
    return (
      <div className="space-y-1">
        {editableHint && (
          <p className="text-xs text-muted-foreground">{editableHint}</p>
        )}
        <Button
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={() => setOpen(true)}
        >
          Corriger le numéro ou le moyen
        </Button>
      </div>
    );
  }

  function save() {
    startTransition(async () => {
      const r = await updateRefundDestinationAction({
        id: refund.id,
        channel: channel !== refund.channel ? channel : undefined,
        delivery: delivery !== refund.delivery ? delivery : undefined,
        destinationPhone: phone.trim() || undefined,
      });
      onDone(r);
      if (r.ok) setOpen(false);
    });
  }

  const unchanged =
    channel === refund.channel && delivery === refund.delivery && !phone.trim();

  return (
    <div className="space-y-3 rounded-lg border p-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="rf-channel">Canal de sortie</Label>
          <select
            id="rf-channel"
            className={selectClass}
            value={channel}
            onChange={(e) => setChannel(e.target.value)}
          >
            {PAYMENT_MODES.map((m) => (
              <option key={m} value={m}>
                {PAYMENT_MODE_LABELS[m]}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="rf-delivery">Envoi</Label>
          <select
            id="rf-delivery"
            className={selectClass}
            value={delivery}
            onChange={(e) => setDelivery(e.target.value)}
          >
            {Object.entries(REFUND_DELIVERY_LABELS).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="rf-phone">
          Nouveau numéro (laisser vide pour garder)
        </Label>
        <Input
          id="rf-phone"
          type="tel"
          inputMode="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="07 00 00 00 00"
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Un administrateur devra revalider avant que l’argent ne parte.
      </p>
      <div className="flex gap-2">
        <Button size="sm" disabled={pending || unchanged} onClick={save}>
          Enregistrer
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={pending}
          onClick={() => setOpen(false)}
        >
          Fermer
        </Button>
      </div>
    </div>
  );
}
