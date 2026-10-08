'use client';

import { Input } from '@heroui/react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  contactFieldsSchema,
  type ContactFieldsInput,
} from '@/lib/schemas/order';
import {
  ORDER_CUSTOMER_NAME_MAX,
  ORDER_CUSTOMER_PHONE_MAX,
} from '@/config/constants';

type ContactFieldsProps = {
  name: string;
  phone: string;
  errors: { customerName?: string; customerPhone?: string };
  onNameChange: (value: string) => void;
  onPhoneChange: (value: string) => void;
};

// Validation live via react-hook-form + le schéma Zod partagé avec le serveur
// (`contactFieldsSchema`, `lib/schemas/order.ts`) : le message affiché sous
// chaque input est toujours celui que l'API appliquerait, jamais un texte
// ad-hoc qui pourrait diverger. `useCheckoutForm` (le parent) reste la source
// de vérité des VALEURS — ce formulaire ne fait que les relayer (onChange) et
// afficher une erreur immédiate, en plus du check final au clic « Confirmer ».
export function ContactFields({
  name,
  phone,
  errors,
  onNameChange,
  onPhoneChange,
}: ContactFieldsProps) {
  const {
    control,
    formState: { errors: liveErrors },
  } = useForm<ContactFieldsInput>({
    resolver: zodResolver(contactFieldsSchema),
    mode: 'onBlur',
    defaultValues: { customerName: name, customerPhone: phone },
  });

  // Le serveur (409/400) peut rattacher une erreur à ces champs après coup
  // (ex. VALIDATION) ; elle prime sur l'état local tant qu'elle n'a pas été
  // corrigée, donc l'erreur affichée est la plus récente des deux sources.
  const nameError = errors.customerName ?? liveErrors.customerName?.message;
  const phoneError = errors.customerPhone ?? liveErrors.customerPhone?.message;

  return (
    <>
      <Controller
        name="customerName"
        control={control}
        render={({ field }) => (
          <Input
            label="Nom complet"
            placeholder="Ex. Axel Kouakou"
            value={name}
            onValueChange={(v) => {
              field.onChange(v);
              onNameChange(v);
            }}
            onBlur={field.onBlur}
            isInvalid={!!nameError}
            errorMessage={nameError}
            isRequired
            autoComplete="name"
            maxLength={ORDER_CUSTOMER_NAME_MAX}
          />
        )}
      />

      <Controller
        name="customerPhone"
        control={control}
        render={({ field }) => (
          <Input
            label="Téléphone"
            type="tel"
            value={phone}
            onValueChange={(v) => {
              field.onChange(v);
              onPhoneChange(v);
            }}
            onBlur={field.onBlur}
            isInvalid={!!phoneError}
            errorMessage={phoneError}
            isRequired
            autoComplete="tel"
            placeholder="07 00 00 00 00"
            maxLength={ORDER_CUSTOMER_PHONE_MAX}
          />
        )}
      />
    </>
  );
}
