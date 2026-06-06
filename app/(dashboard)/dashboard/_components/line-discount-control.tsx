'use client';

import { useState } from 'react';
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
  Input,
  Button,
} from '@heroui/react';
import { Tag } from 'lucide-react';
import { cn } from '@/lib/utils';

const fmt = new Intl.NumberFormat('fr-FR');

type Props = {
  /** Remise maximale autorisée sur la ligne (FCFA). */
  maxDiscount: number;
  /** Remise actuellement appliquée (FCFA). */
  discount: number;
  /** Motif actuel (ou null). */
  reason: string | null;
  onChange: (discount: number, reason: string | null) => void;
  disabled?: boolean;
};

/**
 * Petit contrôle de remise par ligne : un déclencheur « Remise » ouvrant un
 * popover où le caissier saisit un montant fixe (FCFA, plafonné) et un motif
 * optionnel. Réutilisé à la création (panier) et à l'édition d'une commande.
 */
export function LineDiscountControl({
  maxDiscount,
  discount,
  reason,
  onChange,
  disabled,
}: Props) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [why, setWhy] = useState('');
  const [err, setErr] = useState<string | null>(null);

  const hasDiscount = discount > 0;
  const canDiscount = maxDiscount > 0;

  // Désactivé (commande en cours d'enregistrement, ou ligne sans marge de
  // remise) : on rend juste le déclencheur inerte, sans popover.
  if (disabled || !canDiscount) {
    return (
      <span
        className={cn(
          'inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-1 text-xs font-medium opacity-40',
          hasDiscount
            ? 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200'
            : 'text-muted-foreground'
        )}
      >
        <Tag className="size-3.5" />
        {hasDiscount ? `-${fmt.format(discount)} F` : 'Remise'}
      </span>
    );
  }

  function syncFromProps() {
    setAmount(hasDiscount ? String(discount) : '');
    setWhy(reason ?? '');
    setErr(null);
  }

  function apply() {
    const n = Math.floor(Number(amount));
    if (!Number.isFinite(n) || n < 0) {
      setErr('Montant invalide');
      return;
    }
    if (n > maxDiscount) {
      setErr(`Maximum ${fmt.format(maxDiscount)} F`);
      return;
    }
    onChange(n, why.trim() || null);
    setOpen(false);
  }

  function clear() {
    onChange(0, null);
    setOpen(false);
  }

  return (
    <Popover
      isOpen={open}
      onOpenChange={(o) => {
        if (o) syncFromProps();
        setOpen(o);
      }}
      placement="bottom-end"
    >
      <PopoverTrigger>
        <button
          type="button"
          aria-label="Appliquer une remise"
          className={cn(
            'inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-1 text-xs font-medium transition-colors',
            hasDiscount
              ? 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200'
              : 'text-muted-foreground hover:bg-muted'
          )}
        >
          <Tag className="size-3.5" />
          {hasDiscount ? `-${fmt.format(discount)} F` : 'Remise'}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64">
        <div className="w-full space-y-3 px-1 py-2">
          <p className="text-sm font-semibold">Remise sur la ligne</p>
          <Input
            type="number"
            size="sm"
            label="Montant"
            value={amount}
            onValueChange={setAmount}
            min={0}
            max={maxDiscount}
            endContent={<span className="text-xs text-foreground/50">F</span>}
            description={`Maximum ${fmt.format(maxDiscount)} F (50% de la ligne)`}
          />
          <Input
            size="sm"
            label="Motif (optionnel)"
            value={why}
            onValueChange={setWhy}
            placeholder="ex. fidélité"
          />
          {err && <p className="text-xs text-danger">{err}</p>}
          <div className="flex gap-2">
            <Button
              size="sm"
              color="primary"
              className="flex-1"
              onPress={apply}
            >
              Appliquer
            </Button>
            {hasDiscount && (
              <Button size="sm" variant="flat" onPress={clear}>
                Retirer
              </Button>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
