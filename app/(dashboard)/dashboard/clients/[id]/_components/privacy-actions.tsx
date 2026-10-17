'use client';

import { useState, useTransition } from 'react';
import { Download, ShieldOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  anonymizeCustomerAction,
  exportCustomerDataAction,
} from '../../actions';

/**
 * Droits d'accès et d'effacement d'un client (loi 2013-450). L'export remet la
 * fiche, les commandes, la fidélité et les votes ; l'anonymisation retire nom
 * et téléphone mais garde montants et dates des commandes (comptabilité).
 */
export function PrivacyActions({
  customerId,
  anonymized,
}: {
  customerId: string;
  anonymized: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function exportData() {
    setError(null);
    startTransition(async () => {
      const res = await exportCustomerDataAction(customerId);
      if (!res.ok) return setError(res.error);
      const url = URL.createObjectURL(
        new Blob([res.json], { type: 'application/json' })
      );
      const a = document.createElement('a');
      a.href = url;
      a.download = `client-${customerId}.json`;
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  function anonymize() {
    if (
      !window.confirm(
        'Anonymiser ce client ? Son nom, son téléphone, sa fidélité et ses votes seront effacés définitivement. Les montants des commandes sont conservés.'
      )
    )
      return;
    setError(null);
    startTransition(async () => {
      const res = await anonymizeCustomerAction(customerId);
      if (!res.ok) setError(res.error);
    });
  }

  if (anonymized) {
    return (
      <p className="text-sm text-muted-foreground">
        Fiche anonymisée : les données personnelles ont été effacées.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={exportData}
          disabled={pending}
        >
          <Download className="mr-1.5 h-4 w-4" aria-hidden="true" />
          Exporter ses données
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={anonymize}
          disabled={pending}
        >
          <ShieldOff className="mr-1.5 h-4 w-4" aria-hidden="true" />
          Anonymiser
        </Button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
