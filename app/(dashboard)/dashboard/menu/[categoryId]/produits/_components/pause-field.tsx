'use client';

// Pause programmée d'un produit — extrait de `product-form.tsx`.
//
// Autonome par construction : ce bloc appelle directement
// `pauseProductAction`/`resumeProductAction`, qui agissent sur le produit DÉJÀ
// persisté. Il n'entre donc pas dans le payload du formulaire et n'a pas à
// remonter d'état — d'où l'extraction, qui allège d'autant la fiche produit.

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useUndoToast } from '@/lib/hooks/use-undo-toast';
import { pauseProductAction, resumeProductAction } from '../../../actions';
import {
  abidjanDatetimeLocalToISO,
  formatAbidjanDateTime,
} from '@/lib/timezone';
import { isPausedNow } from '@/lib/supplements';

export function PauseField({
  productId,
  initialUnavailableUntil,
}: {
  productId: string;
  initialUnavailableUntil: Date | null;
}) {
  const router = useRouter();
  const { pushToast } = useUndoToast();
  const [unavailableUntil, setUnavailableUntil] = useState<Date | null>(
    initialUnavailableUntil
  );
  const [customInput, setCustomInput] = useState('');
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const isPaused = isPausedNow(unavailableUntil);

  function applyPause(until: Date) {
    setError(null);
    startTransition(async () => {
      const result = await pauseProductAction(productId, until.toISOString());
      if (!result.ok) {
        setError(result.error);
        pushToast(result.error, 'error');
        return;
      }
      setUnavailableUntil(until);
      router.refresh();
      pushToast(`En pause jusqu’au ${formatAbidjanDateTime(until)}`);
    });
  }

  function handlePauseHours(hours: number) {
    applyPause(new Date(Date.now() + hours * 60 * 60 * 1000));
  }

  function handlePauseCustom() {
    const iso = abidjanDatetimeLocalToISO(customInput);
    if (!iso) {
      setError('Date/heure invalide');
      return;
    }
    const until = new Date(iso);
    if (until.getTime() <= Date.now()) {
      setError('La reprise doit être dans le futur');
      return;
    }
    applyPause(until);
  }

  function handleResume() {
    setError(null);
    startTransition(async () => {
      const result = await resumeProductAction(productId);
      if (!result.ok) {
        setError(result.error);
        pushToast(result.error, 'error');
        return;
      }
      setUnavailableUntil(null);
      setCustomInput('');
      router.refresh();
      pushToast('Produit de nouveau disponible');
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Pause programmée</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm">
          {isPaused && unavailableUntil ? (
            <span className="font-medium text-amber-600">
              En pause jusqu&apos;au {formatAbidjanDateTime(unavailableUntil)}
            </span>
          ) : (
            <span className="text-muted-foreground">
              Disponible (pas de pause en cours).
            </span>
          )}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isPending}
            onClick={() => handlePauseHours(1)}
          >
            +1h
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isPending}
            onClick={() => handlePauseHours(2)}
          >
            +2h
          </Button>
          <Input
            type="datetime-local"
            value={customInput}
            onChange={(e) => setCustomInput(e.target.value)}
            className="w-auto"
            aria-label="Reprise programmée à une date/heure précise"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isPending || !customInput}
            onClick={handlePauseCustom}
          >
            Programmer
          </Button>
          {isPaused && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={isPending}
              onClick={handleResume}
            >
              Remettre disponible
            </Button>
          )}
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}
