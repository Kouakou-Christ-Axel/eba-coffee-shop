'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ORDER_NOTE_MAX } from '@/config/constants';
import type { OrderType } from '@/generated/prisma/client';
import { OrderTypePicker } from './order-type-picker';

type Props = {
  customerName: string;
  customerPhone: string;
  orderType: OrderType;
  note: string;
  submitError: string | null;
  onCustomerNameChange: (value: string) => void;
  onCustomerPhoneChange: (value: string) => void;
  onOrderTypeChange: (value: OrderType) => void;
  onNoteChange: (value: string) => void;
};

export function CustomerInfoStep({
  customerName,
  customerPhone,
  orderType,
  note,
  submitError,
  onCustomerNameChange,
  onCustomerPhoneChange,
  onOrderTypeChange,
  onNoteChange,
}: Props) {
  return (
    <div className="space-y-3">
      <OrderTypePicker value={orderType} onChange={onOrderTypeChange} />

      <div className="rounded-xl border bg-card p-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Client
        </p>
        <div className="grid gap-2">
          <div className="grid gap-1">
            <Label
              htmlFor="customer-phone"
              className="text-xs text-muted-foreground"
            >
              Téléphone
            </Label>
            <Input
              id="customer-phone"
              type="tel"
              inputMode="tel"
              value={customerPhone}
              onChange={(e) => onCustomerPhoneChange(e.target.value)}
              placeholder="07 88 12 34 56"
              autoComplete="off"
            />
          </div>
          <div className="grid gap-1">
            <Label
              htmlFor="customer-name"
              className="text-xs text-muted-foreground"
            >
              Prénom
            </Label>
            <Input
              id="customer-name"
              value={customerName}
              onChange={(e) => onCustomerNameChange(e.target.value)}
              placeholder="Client anonyme"
              autoComplete="off"
            />
          </div>
          <div className="grid gap-1">
            <Label htmlFor="note" className="text-xs text-muted-foreground">
              Note
            </Label>
            <Textarea
              id="note"
              value={note}
              onChange={(e) => onNoteChange(e.target.value)}
              placeholder="Sans sucre, à emporter, etc."
              rows={2}
              maxLength={ORDER_NOTE_MAX}
            />
          </div>
        </div>
      </div>

      {submitError && <p className="text-sm text-destructive">{submitError}</p>}
    </div>
  );
}
