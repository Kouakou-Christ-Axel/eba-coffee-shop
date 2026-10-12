'use client';

import { Button, Input } from '@heroui/react';
import type { AssociateCustomerState } from './use-associate-customer';

export function ManualCustomerSection({
  state,
}: {
  state: AssociateCustomerState;
}) {
  const {
    manualPhone,
    setManualPhone,
    manualName,
    setManualName,
    isPending,
    submit,
  } = state;
  return (
    <div className="space-y-2 border-t border-default-200 pt-4">
      <p className="text-sm font-medium text-default-600">
        Ou saisir un nouveau client
      </p>
      <Input
        label="Nom (optionnel)"
        value={manualName}
        onValueChange={setManualName}
        autoComplete="off"
      />
      <Input
        label="Téléphone"
        type="tel"
        inputMode="tel"
        placeholder="07 88 12 34 56"
        value={manualPhone}
        onValueChange={setManualPhone}
        autoComplete="off"
      />
      <Button
        type="button"
        color="primary"
        isDisabled={manualPhone.trim().length === 0}
        isLoading={isPending}
        onPress={() =>
          submit({
            phone: manualPhone.trim(),
            name: manualName.trim() || null,
          })
        }
      >
        Associer ce client
      </Button>
    </div>
  );
}
