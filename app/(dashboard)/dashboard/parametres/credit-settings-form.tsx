'use client';

import { useState, useTransition } from 'react';
import { Loader2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { computeCreditApplication } from '@/lib/credits/apply';
import type { CreditSettings } from '@/lib/credit-settings';
import { saveCreditSettings } from './actions';

const EXAMPLE_TOTAL = 4000;

export function CreditSettingsForm({ initial }: { initial: CreditSettings }) {
  const [s, setS] = useState<CreditSettings>(initial);
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{
    kind: 'success' | 'error';
    msg: string;
  } | null>(null);

  function save() {
    setFeedback(null);
    startTransition(async () => {
      const r = await saveCreditSettings(s);
      setFeedback(
        r.ok
          ? { kind: 'success', msg: 'Réglages enregistrés.' }
          : { kind: 'error', msg: r.error }
      );
    });
  }

  const example = computeCreditApplication({
    balance: 10_000,
    total: EXAMPLE_TOTAL,
    settings: { ...s, enabled: true },
  });
  const fmt = new Intl.NumberFormat('fr-FR');

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Avoirs — solde client</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex items-center gap-2">
          <Switch
            id="credit-enabled"
            checked={s.enabled}
            onCheckedChange={(v) => setS((p) => ({ ...p, enabled: v }))}
          />
          <Label htmlFor="credit-enabled">
            Avoirs utilisables (caisse et commande en ligne)
          </Label>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="minRemaining">Reste minimum à payer (FCFA)</Label>
            <Input
              id="minRemaining"
              type="number"
              min={0}
              inputMode="numeric"
              value={s.minRemaining}
              onChange={(e) =>
                setS((p) => ({
                  ...p,
                  minRemaining: Number(e.target.value) || 0,
                }))
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="maxPercent">Part max. de la commande (%)</Label>
            <Input
              id="maxPercent"
              type="number"
              min={1}
              max={100}
              inputMode="numeric"
              value={s.maxPercent}
              onChange={(e) =>
                setS((p) => ({
                  ...p,
                  maxPercent: Number(e.target.value) || 0,
                }))
              }
            />
          </div>
        </div>

        <p className="text-sm text-muted-foreground">
          Le client paie toujours au moins {fmt.format(s.minRemaining)} F et
          l’avoir ne couvre jamais plus de {s.maxPercent} % de la commande.
          Exemple : sur {fmt.format(EXAMPLE_TOTAL)} F avec 10 000 F d’avoir,{' '}
          <span className="font-medium text-foreground">
            {fmt.format(example)} F
          </span>{' '}
          sont déduits.
        </p>

        {feedback && (
          <p
            className={
              feedback.kind === 'success'
                ? 'text-sm text-green-600'
                : 'text-sm text-destructive'
            }
          >
            {feedback.msg}
          </p>
        )}

        <Button onClick={save} disabled={pending}>
          {pending ? (
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-1.5 h-4 w-4" />
          )}
          Enregistrer
        </Button>
      </CardContent>
    </Card>
  );
}
