'use client';

// components/(public)/carte/_components/pickup-mode-cards.tsx
//
// 1ʳᵉ question du checkout : « Comment récupères-tu ta commande ? »
// Deux cartes : « Je viens moi-même » (TAKEAWAY) / « J'envoie un livreur »
// (DELIVERY — le livreur du CLIENT, le coffee shop ne livre pas).
//
// En mode livreur : champs nom + téléphone (optionnels, complétables depuis la
// page de suivi) et lieu de retrait + lien Maps, pour que le client fasse
// estimer la course AVANT de payer — comme dans le processus WhatsApp manuel.

import { Input } from '@heroui/react';
import { Bike, MapPin, ShoppingBag } from 'lucide-react';
import type { PickupMode } from '@/lib/hooks/use-checkout-form';
import {
  ORDER_CUSTOMER_NAME_MAX,
  ORDER_CUSTOMER_PHONE_MAX,
} from '@/config/constants';
import { cn } from '@/lib/utils';

const MODES: {
  mode: PickupMode;
  label: string;
  hint: string;
  Icon: typeof Bike;
}[] = [
  {
    mode: 'pickup',
    label: 'Je viens moi-même',
    hint: 'Retrait au comptoir',
    Icon: ShoppingBag,
  },
  {
    mode: 'driver',
    label: "J'envoie un livreur",
    hint: 'Ton livreur récupère',
    Icon: Bike,
  },
];

type PickupModeCardsProps = {
  mode: PickupMode;
  onModeChange: (mode: PickupMode) => void;
  driverName: string;
  driverPhone: string;
  errors: { driverName?: string; driverPhone?: string };
  onDriverNameChange: (value: string) => void;
  onDriverPhoneChange: (value: string) => void;
  pickupAddress: string | null;
  pickupMapsUrl: string | null;
};

export function PickupModeCards({
  mode,
  onModeChange,
  driverName,
  driverPhone,
  errors,
  onDriverNameChange,
  onDriverPhoneChange,
  pickupAddress,
  pickupMapsUrl,
}: PickupModeCardsProps) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-medium">Comment récupères-tu ta commande ?</p>

      <div
        role="radiogroup"
        aria-label="Mode de récupération"
        className="grid grid-cols-2 gap-2"
      >
        {MODES.map(({ mode: m, label, hint, Icon }) => {
          const selected = mode === m;
          return (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onModeChange(m)}
              className={cn(
                'flex flex-col items-center gap-1.5 rounded-xl border-2 px-3 py-4 text-center transition-all',
                selected
                  ? 'border-primary bg-primary/5'
                  : 'border-foreground/10 hover:border-primary/40 hover:bg-primary/5'
              )}
            >
              <Icon
                className={cn(
                  'h-6 w-6',
                  selected ? 'text-primary' : 'text-foreground/40'
                )}
              />
              <span
                className={cn(
                  'text-sm font-semibold leading-tight',
                  selected ? 'text-primary' : 'text-foreground'
                )}
              >
                {label}
              </span>
              <span className="text-xs text-foreground/50">{hint}</span>
            </button>
          );
        })}
      </div>

      {mode === 'driver' && (
        <div className="flex flex-col gap-3 rounded-xl border border-foreground/10 bg-default-50 p-4">
          {(pickupAddress || pickupMapsUrl) && (
            <div className="flex items-start gap-2 text-xs text-foreground/60">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <p>
                {pickupAddress && (
                  <span className="font-medium text-foreground/80">
                    {pickupAddress}
                  </span>
                )}
                {pickupAddress && <br />}
                Fais estimer la course à ton livreur avant de payer.
                {pickupMapsUrl && (
                  <>
                    {' '}
                    <a
                      href={pickupMapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-primary underline-offset-2 hover:underline"
                    >
                      Voir sur Google Maps →
                    </a>
                  </>
                )}
              </p>
            </div>
          )}

          <Input
            label="Nom du livreur"
            value={driverName}
            onValueChange={onDriverNameChange}
            isInvalid={!!errors.driverName}
            errorMessage={errors.driverName}
            maxLength={ORDER_CUSTOMER_NAME_MAX}
            size="sm"
          />
          <Input
            label="Téléphone du livreur"
            type="tel"
            value={driverPhone}
            onValueChange={onDriverPhoneChange}
            isInvalid={!!errors.driverPhone}
            errorMessage={errors.driverPhone}
            placeholder="07 00 00 00 00"
            maxLength={ORDER_CUSTOMER_PHONE_MAX}
            size="sm"
          />
          <p className="text-xs text-foreground/50">
            Tu ne le connais pas encore&nbsp;? Laisse vide — tu pourras
            l&apos;ajouter depuis la page de suivi de ta commande.
          </p>
        </div>
      )}
    </div>
  );
}
