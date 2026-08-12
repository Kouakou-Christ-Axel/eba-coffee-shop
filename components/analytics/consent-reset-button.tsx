'use client';

// components/analytics/consent-reset-button.tsx
//
// Bouton « Modifier mon choix » de la page /cookies. Efface le choix stocké et
// repasse le store en 'pending' — la bannière (montée dans le layout public)
// réapparaît immédiatement, sans rechargement.

import React from 'react';
import { Button } from '@heroui/react';
import { IconRefresh } from '@tabler/icons-react';
import { useConsentStore } from '@/lib/consent-store';
import { clearConsent, readConsentStatus } from '@/lib/consent-storage';
import { updateConsent } from '@/lib/analytics';

const STATUS_LABEL: Record<string, string> = {
  pending: 'Aucun choix enregistré pour le moment.',
  granted: 'Vous avez accepté la mesure d’audience.',
  denied: 'Vous avez refusé la mesure d’audience.',
};

export function ConsentResetButton() {
  const status = useConsentStore((s) => s.status);
  const setStatus = useConsentStore((s) => s.setStatus);
  // Le statut n'est lisible qu'après montage (localStorage) : sans cette
  // garde, le serveur rendrait « aucun choix » et le client autre chose.
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setStatus(readConsentStatus());
    setMounted(true);
  }, [setStatus]);

  const reset = React.useCallback(() => {
    clearConsent();
    // On repasse Consent Mode en 'denied' sans attendre : tant que le visiteur
    // n'a pas retranché, plus rien ne doit être mesuré.
    updateConsent(false);
    setStatus('pending');
  }, [setStatus]);

  return (
    <div className="mt-4 flex flex-col gap-3 rounded-large border border-default-200 bg-content1/60 p-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-default-600">
        {mounted ? STATUS_LABEL[status] : STATUS_LABEL.pending}
      </p>
      <Button
        color="primary"
        variant="flat"
        radius="md"
        size="sm"
        className="shrink-0"
        startContent={<IconRefresh size={16} aria-hidden />}
        onPress={reset}
        isDisabled={mounted && status === 'pending'}
      >
        Modifier mon choix
      </Button>
    </div>
  );
}

export default ConsentResetButton;
