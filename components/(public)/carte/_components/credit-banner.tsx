'use client';

// components/(public)/carte/_components/credit-banner.tsx
//
// « Tu as un avoir » — affiché au checkout en ligne dès que le téléphone saisi
// correspond à un client avec un solde d'avoir. Appliqué par défaut comme une
// réduction ; le Switch permet de le garder pour une prochaine commande.

import { Switch } from '@heroui/react';
import { m, useReducedMotion } from 'framer-motion';
import { Wallet } from 'lucide-react';
import { priceFormatter } from '@/config/menu';

type Props = {
  applicable: number;
  balance: number;
  applied: boolean;
  onAppliedChange: (applied: boolean) => void;
};

export function CreditBanner({
  applicable,
  balance,
  applied,
  onAppliedChange,
}: Props) {
  const reduceMotion = useReducedMotion();
  const keeps = balance - applicable;

  return (
    <m.div
      initial={reduceMotion ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="rounded-xl border border-primary/20 bg-primary/5 p-4"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <Wallet className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div>
            <p className="text-sm font-semibold text-primary">
              Tu as un avoir de {priceFormatter.format(balance)}&nbsp;F
            </p>
            <p className="mt-0.5 text-xs text-foreground/60">
              −{priceFormatter.format(applicable)}&nbsp;F sur cette commande
              {applied ? ', déduits du total ci-dessous' : ''}
              {keeps > 0
                ? `. Il t’en restera ${priceFormatter.format(keeps)} F${applied ? '' : ' en tout'}.`
                : '.'}
            </p>
          </div>
        </div>
        <Switch
          size="sm"
          isSelected={applied}
          onValueChange={onAppliedChange}
          aria-label="Utiliser mon avoir"
        />
      </div>
    </m.div>
  );
}
