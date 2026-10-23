'use client';

import { useState, useTransition } from 'react';
import { Loader2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { JekoAccount } from '@/lib/jeko/accounts';
import {
  WITHDRAWAL_FEE_MODES,
  WITHDRAWAL_FEE_MODE_LABELS,
  maxWithdrawable,
  withdrawalDebit,
  withdrawalFee,
  type WithdrawalFeeMode,
} from '@/lib/jeko/accounting';
import { deleteWithdrawalAction, recordWithdrawalAction } from './actions';

const fmt = new Intl.NumberFormat('fr-FR');

export function WithdrawalForm({
  balance,
  account,
}: {
  /** Solde attendu du compte : le retirable max dépend du tarif choisi. */
  balance: number;
  account: JekoAccount;
}) {
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [feeMode, setFeeMode] = useState<WithdrawalFeeMode>('percent');
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const n = Number(amount);
  const valid = Number.isInteger(n) && n > 0;

  function submit() {
    setError(null);
    start(async () => {
      const res = await recordWithdrawalAction({
        amount: n,
        note,
        account,
        feeMode,
      });
      if (res.ok) {
        setAmount('');
        setNote('');
      } else setError(res.error);
    });
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_2fr]">
        <div className="space-y-1.5">
          <Label htmlFor={`jeko-amount-${account}`}>Montant retiré (F)</Label>
          <Input
            id={`jeko-amount-${account}`}
            inputMode="numeric"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))}
            placeholder={fmt.format(maxWithdrawable(balance, feeMode))}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`jeko-fee-${account}`}>Frais de retrait</Label>
          <select
            id={`jeko-fee-${account}`}
            value={feeMode}
            onChange={(e) => setFeeMode(e.target.value as WithdrawalFeeMode)}
            className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
          >
            {WITHDRAWAL_FEE_MODES.map((m) => (
              <option key={m} value={m}>
                {WITHDRAWAL_FEE_MODE_LABELS[m]}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`jeko-note-${account}`}>Note (facultatif)</Label>
          <Input
            id={`jeko-note-${account}`}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={200}
          />
        </div>
      </div>
      {valid && (
        <p className="text-sm text-muted-foreground">
          Frais de retrait {fmt.format(withdrawalFee(n, feeMode))} F · le compte
          Jèko sera débité de{' '}
          <strong>{fmt.format(withdrawalDebit(n, feeMode))} F</strong>.
        </p>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button onClick={submit} disabled={!valid || pending}>
        {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Enregistrer le retrait
      </Button>
    </div>
  );
}

export function DeleteWithdrawalButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Supprimer ce retrait"
      disabled={pending}
      onClick={() => start(async () => void (await deleteWithdrawalAction(id)))}
    >
      <Trash2 className="h-4 w-4" />
    </Button>
  );
}
