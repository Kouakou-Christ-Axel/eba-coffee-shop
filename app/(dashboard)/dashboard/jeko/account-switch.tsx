'use client';

import { useState, useTransition } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { JekoAccount } from '@/lib/jeko/accounts';
import { setActiveAccountAction } from './actions';

/** Choix du compte qui encaisse les NOUVEAUX paiements (admin). */
export function AccountSwitch({
  active,
  accounts,
}: {
  active: JekoAccount;
  /** Comptes dont les variables d'environnement sont renseignées. */
  accounts: JekoAccount[];
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function choose(account: JekoAccount) {
    setError(null);
    start(async () => {
      const res = await setActiveAccountAction(account);
      if (!res.ok) setError(res.error);
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {accounts.map((a) => (
          <Button
            key={a}
            variant={a === active ? 'default' : 'outline'}
            aria-pressed={a === active}
            disabled={pending || a === active}
            onClick={() => choose(a)}
          >
            {pending && a !== active && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Compte {a}
            {a === active && ' · actif'}
          </Button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Les nouveaux paiements en ligne partent sur le compte actif. Les
        paiements déjà lancés, leurs vérifications et leurs remboursements
        restent sur le compte qui les a encaissés.
      </p>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
