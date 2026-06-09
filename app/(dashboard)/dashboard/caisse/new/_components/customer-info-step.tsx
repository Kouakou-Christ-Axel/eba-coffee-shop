'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { ORDER_NOTE_MAX } from '@/config/constants';
import { todayDateString } from '@/lib/timezone';
import type { OrderType } from '@/generated/prisma/client';
import { OrderTypePicker } from './order-type-picker';

type Props = {
  customerName: string;
  customerPhone: string;
  orderType: OrderType;
  note: string;
  pickupTime: string | null;
  orderDate: string | null;
  submitError: string | null;
  onCustomerNameChange: (value: string) => void;
  onCustomerPhoneChange: (value: string) => void;
  onOrderTypeChange: (value: OrderType) => void;
  onNoteChange: (value: string) => void;
  onPickupTimeChange: (value: string | null) => void;
  onOrderDateChange: (value: string | null) => void;
};

function toLocalDatetimeValue(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function defaultPickupTime(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() + 60);
  d.setSeconds(0, 0);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function CustomerInfoStep({
  customerName,
  customerPhone,
  orderType,
  note,
  pickupTime,
  orderDate,
  submitError,
  onCustomerNameChange,
  onCustomerPhoneChange,
  onOrderTypeChange,
  onNoteChange,
  onPickupTimeChange,
  onOrderDateChange,
}: Props) {
  const isScheduled = pickupTime !== null;
  const today = todayDateString();
  const isBackdated = orderDate !== null && orderDate !== today;

  function handleOrderDateChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value;
    // Vide ou égal à aujourd'hui → jour en cours (null).
    onOrderDateChange(value && value !== today ? value : null);
  }

  function handleScheduledToggle(checked: boolean) {
    onPickupTimeChange(checked ? defaultPickupTime() : null);
  }

  function handleDatetimeChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.value) return;
    const local = e.target.value;
    const iso = new Date(local).toISOString();
    onPickupTimeChange(iso);
  }

  const minDatetime = (() => {
    const d = new Date();
    d.setMinutes(d.getMinutes() + 5);
    d.setSeconds(0, 0);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  })();

  return (
    <div className="space-y-3">
      <OrderTypePicker value={orderType} onChange={onOrderTypeChange} />

      <div className="rounded-xl border bg-card p-3">
        <div className="grid gap-1">
          <Label htmlFor="order-date" className="text-xs text-muted-foreground">
            Date de la commande
          </Label>
          <Input
            id="order-date"
            type="date"
            value={orderDate ?? today}
            onChange={handleOrderDateChange}
            max={today}
          />
          {isBackdated && (
            <p className="mt-1 text-xs text-primary">
              Commande antidatée — sera enregistrée au {orderDate}.
            </p>
          )}
        </div>
      </div>

      <div className="rounded-xl border bg-card p-3">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Programmer pour plus tard
          </p>
          <Switch
            checked={isScheduled}
            onCheckedChange={handleScheduledToggle}
            aria-label="Commande différée"
          />
        </div>
        {isScheduled && (
          <div className="mt-2 grid gap-1">
            <Label
              htmlFor="pickup-time"
              className="text-xs text-muted-foreground"
            >
              Date et heure de retrait
            </Label>
            <Input
              id="pickup-time"
              type="datetime-local"
              value={pickupTime ? toLocalDatetimeValue(pickupTime) : ''}
              onChange={handleDatetimeChange}
              min={minDatetime}
            />
          </div>
        )}
      </div>

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
              {isScheduled && (
                <span className="ml-1 text-primary">* obligatoire</span>
              )}
            </Label>
            <Input
              id="customer-phone"
              type="tel"
              inputMode="tel"
              value={customerPhone}
              onChange={(e) => onCustomerPhoneChange(e.target.value)}
              placeholder="07 88 12 34 56"
              autoComplete="off"
              required={isScheduled}
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
