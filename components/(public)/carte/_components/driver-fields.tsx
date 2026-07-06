'use client';

// Bloc livreur optionnel du checkout : le client indique qu'un livreur (à lui)
// viendra récupérer la commande, et peut renseigner son nom + téléphone tout
// de suite — ou plus tard depuis la page de suivi (« ça peut changer »).

import { useState } from 'react';
import { Input, Switch } from '@heroui/react';
import { Bike } from 'lucide-react';
import {
  ORDER_CUSTOMER_NAME_MAX,
  ORDER_CUSTOMER_PHONE_MAX,
} from '@/config/constants';

type DriverFieldsProps = {
  name: string;
  phone: string;
  errors: { driverName?: string; driverPhone?: string };
  onNameChange: (value: string) => void;
  onPhoneChange: (value: string) => void;
};

export function DriverFields({
  name,
  phone,
  errors,
  onNameChange,
  onPhoneChange,
}: DriverFieldsProps) {
  const [enabled, setEnabled] = useState(Boolean(name || phone));

  function toggle(next: boolean) {
    setEnabled(next);
    if (!next) {
      // Bloc replié = pas de livreur transmis (champs vidés).
      onNameChange('');
      onPhoneChange('');
    }
  }

  return (
    <div className="rounded-xl border border-foreground/10 bg-default-50 p-4">
      <Switch isSelected={enabled} onValueChange={toggle} size="sm">
        <span className="flex items-center gap-1.5 text-sm">
          <Bike className="h-4 w-4 text-foreground/60" />
          Un livreur viendra récupérer ma commande
        </span>
      </Switch>

      {enabled && (
        <div className="mt-3 flex flex-col gap-3">
          <Input
            label="Nom du livreur"
            value={name}
            onValueChange={onNameChange}
            isInvalid={!!errors.driverName}
            errorMessage={errors.driverName}
            maxLength={ORDER_CUSTOMER_NAME_MAX}
            size="sm"
          />
          <Input
            label="Téléphone du livreur"
            type="tel"
            value={phone}
            onValueChange={onPhoneChange}
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
