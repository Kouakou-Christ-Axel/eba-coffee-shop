'use client';

// components/(public)/carte/_components/loyalty-reward-banner.tsx
//
// « 🎁 Tu as une récompense fidélité ! » — affiché au checkout dès que le
// téléphone saisi correspond à un client avec une récompense AVAILABLE.
// Appliquée par défaut (frictionless) ; le Switch permet de la garder pour
// une prochaine commande.

import { Switch } from '@heroui/react';
import { m, useReducedMotion } from 'framer-motion';
import { Gift } from 'lucide-react';
import { priceFormatter } from '@/config/menu';

type Props = {
  capAmount: number;
  applied: boolean;
  onAppliedChange: (applied: boolean) => void;
};

export function LoyaltyRewardBanner({
  capAmount,
  applied,
  onAppliedChange,
}: Props) {
  const reduceMotion = useReducedMotion();

  return (
    <m.div
      initial={reduceMotion ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="rounded-xl border border-primary/20 bg-primary/5 p-4"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <Gift className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div>
            <p className="text-sm font-semibold text-primary">
              Tu as une récompense fidélité&nbsp;! 🎁
            </p>
            <p className="mt-0.5 text-xs text-foreground/60">
              Jusqu’à −{priceFormatter.format(capAmount)}&nbsp;F sur cette
              commande{applied ? ', déduite du total ci-dessous' : ''}.
            </p>
          </div>
        </div>
        <Switch
          size="sm"
          isSelected={applied}
          onValueChange={onAppliedChange}
          aria-label="Utiliser ma récompense fidélité"
        />
      </div>
    </m.div>
  );
}
