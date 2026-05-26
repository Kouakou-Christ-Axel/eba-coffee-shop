'use client';

import { Input } from '@heroui/react';
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

export function ContactFields({
  name,
  phone,
  errors,
  onNameChange,
  onPhoneChange,
}: ContactFieldsProps) {
  return (
    <>
      <Input
        label="Prénom"
        value={name}
        onValueChange={onNameChange}
        isInvalid={!!errors.customerName}
        errorMessage={errors.customerName}
        isRequired
        autoComplete="given-name"
        maxLength={ORDER_CUSTOMER_NAME_MAX}
      />

      <Input
        label="Téléphone"
        type="tel"
        value={phone}
        onValueChange={onPhoneChange}
        isInvalid={!!errors.customerPhone}
        errorMessage={errors.customerPhone}
        isRequired
        autoComplete="tel"
        placeholder="07 00 00 00 00"
        maxLength={ORDER_CUSTOMER_PHONE_MAX}
      />
    </>
  );
}
