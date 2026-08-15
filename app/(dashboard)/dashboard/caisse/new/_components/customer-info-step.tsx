'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ORDER_NOTE_MAX } from '@/config/constants';
import { todayDateString, isoToAbidjanDatetimeLocal } from '@/lib/timezone';
import type { OrderType } from '@/generated/prisma/client';
import { OrderTypePicker } from './order-type-picker';
import { CustomerSearchSelect } from './customer-search-select';
import { PickupDayBar } from './pickup-day-bar';

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
  // Commande à créneau : le téléphone devient obligatoire (il faut pouvoir
  // prévenir le client le jour du retrait) — règle appliquée à la soumission
  // dans `useNewOrder.submit`.
  const isScheduled = pickupTime !== null;
  const today = todayDateString();
  const isBackdated = orderDate !== null && orderDate !== today;
  // Antidater ET planifier un retrait un autre jour est contradictoire :
  // « enregistrée mardi dernier, à retirer demain » n'a pas de sens en file.
  // Signalé ici, et refusé côté serveur (`createCashierOrderSchema`).
  const pickupDay = pickupTime
    ? isoToAbidjanDatetimeLocal(pickupTime).slice(0, 10)
    : null;
  const conflictsWithPickup =
    isBackdated && pickupDay !== null && pickupDay !== orderDate;

  function handleOrderDateChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value;
    // Vide ou égal à aujourd'hui → jour en cours (null).
    onOrderDateChange(value && value !== today ? value : null);
  }

  return (
    <div className="space-y-3">
      <OrderTypePicker value={orderType} onChange={onOrderTypeChange} />

      {/* MÊME composant qu'en haut du catalogue, branché sur le MÊME état :
          les deux vues ne peuvent pas diverger. Variante `full` : l'heure
          exacte se règle ici, le catalogue n'avait besoin que du jour. */}
      <PickupDayBar
        pickupTime={pickupTime}
        onChange={onPickupTimeChange}
        variant="full"
      />

      {/* ANTIDATAGE — à ne pas confondre avec le retrait ci-dessus. Les deux
          champs sont de sens OPPOSÉ : celui-ci rattache la commande à un jour
          PASSÉ (saisie de rattrapage, oubli d'encaissement), l'autre planifie
          un retrait FUTUR. Replié par défaut : c'est un geste rare, il n'a
          rien à faire au même niveau de lecture que le créneau. */}
      <details className="rounded-xl border bg-card p-3" open={isBackdated}>
        <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Saisie de rattrapage (antidater)
        </summary>
        <div className="mt-2 grid gap-1">
          <Label htmlFor="order-date" className="text-xs text-muted-foreground">
            Jour d’enregistrement
          </Label>
          <Input
            id="order-date"
            type="date"
            value={orderDate ?? today}
            onChange={handleOrderDateChange}
            max={today}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Enregistre la commande sur un jour passé. Sans rapport avec la date
            de retrait.
          </p>
          {isBackdated && (
            <p className="mt-1 text-xs text-primary">
              Commande antidatée — sera enregistrée au {orderDate}.
            </p>
          )}
          {conflictsWithPickup && (
            <p
              role="alert"
              className="mt-1 text-xs font-semibold text-destructive"
            >
              Une commande antidatée ne peut pas avoir un retrait un autre jour.
              Choisissez l’un ou l’autre.
            </p>
          )}
        </div>
      </details>

      <div className="rounded-xl border bg-card p-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Client
        </p>
        <div className="grid gap-2">
          <div className="grid gap-1">
            <Label
              htmlFor="customer-search"
              className="text-xs text-muted-foreground"
            >
              Rechercher un client existant
            </Label>
            <CustomerSearchSelect
              onSelect={(c) => {
                onCustomerPhoneChange(c.phone);
                onCustomerNameChange(c.name ?? '');
              }}
            />
          </div>
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
