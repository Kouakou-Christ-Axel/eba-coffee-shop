'use client';

import { Button, Checkbox, Radio, RadioGroup } from '@heroui/react';
import { Minus, Plus } from 'lucide-react';
import { priceFormatter, type SupplementGroup } from '@/config/menu';
import { multipleSelection, optionQuantity } from '@/lib/supplements';
import type { SupplementModalState } from './use-supplement-modal';

type Options = SupplementGroup['options'];

export function SingleOptions({
  group,
  options,
  modal,
}: {
  group: SupplementGroup;
  options: Options;
  modal: SupplementModalState;
}) {
  const { selections, setSingle, strictStock } = modal;
  return (
    <RadioGroup
      value={selections[group.name] as string}
      onValueChange={(v) => setSingle(group.name, v)}
    >
      {options.map((opt) => (
        <Radio
          key={opt.name}
          value={opt.name}
          isDisabled={strictStock && opt.soldOut === true}
        >
          <span className="flex items-center justify-between gap-4">
            <span className="text-sm">
              {opt.name}
              {opt.soldOut && (
                <span className="ml-1.5 text-xs font-medium text-danger">
                  épuisé
                </span>
              )}
            </span>
            {/* Le prix d'une option payante est un argument : on le
                          traite en secondary plutôt qu'en gris de formulaire. */}
            <span
              className={
                opt.price === 0
                  ? 'text-xs text-foreground/50'
                  : 'text-xs font-semibold text-secondary-600'
              }
            >
              {opt.price === 0
                ? 'Inclus'
                : `+${priceFormatter.format(opt.price)} F`}
            </span>
          </span>
        </Radio>
      ))}
    </RadioGroup>
  );
}

export function MultipleOptions({
  group,
  options,
  count,
  max,
  modal,
}: {
  group: SupplementGroup;
  options: Options;
  count: number;
  max: number;
  modal: SupplementModalState;
}) {
  const { selections, toggleMultiple, strictStock } = modal;
  return (
    <div className="space-y-2">
      {options.map((opt) => {
        const current = multipleSelection(selections, group.name);
        const isChecked = current.includes(opt.name);
        const isDisabled =
          (!isChecked && count >= max) || (strictStock && opt.soldOut === true);
        return (
          <Checkbox
            key={opt.name}
            isSelected={isChecked}
            isDisabled={isDisabled}
            onValueChange={() => toggleMultiple(group.name, opt.name)}
          >
            <span className="flex items-center justify-between gap-4">
              <span className="text-sm">
                {opt.name}
                {opt.soldOut && (
                  <span className="ml-1.5 text-xs font-medium text-danger">
                    épuisé
                  </span>
                )}
              </span>
              <span className="text-xs font-semibold text-secondary-600">
                +{priceFormatter.format(opt.price)} F
              </span>
            </span>
          </Checkbox>
        );
      })}
    </div>
  );
}

export function QuantityOptions({
  group,
  options,
  count,
  max,
  modal,
}: {
  group: SupplementGroup;
  options: Options;
  count: number;
  max: number;
  modal: SupplementModalState;
}) {
  const { selections, setOptionQuantity, strictStock } = modal;
  return (
    <div className="space-y-2">
      {options.map((opt) => {
        const qty = optionQuantity(group, selections, opt.name);
        // Plafond de l'option : borne du groupe (répartition
        // totale) ET stock restant de l'option elle-même — la
        // plus stricte des deux gagne.
        // Le stock du jour ne plafonne pas une commande pour plus tard.
        // Sauf en `strictStock` : retrait immédiat, l'épuisé est à 0.
        const optionCap = opt.soldOut
          ? strictStock
            ? 0
            : Infinity
          : (opt.remaining ?? Infinity);
        const canIncrement = count < max && qty < optionCap;
        return (
          <div
            key={opt.name}
            className="flex items-center justify-between gap-4"
          >
            <span className="text-sm">
              {opt.name}
              {opt.price > 0 && (
                <span className="ml-1 text-xs font-semibold text-secondary-600">
                  +{priceFormatter.format(opt.price)} F
                </span>
              )}
              {opt.soldOut && (
                <span className="ml-1.5 text-xs font-medium text-danger">
                  épuisé
                </span>
              )}
            </span>
            <div className="flex items-center gap-2">
              <Button
                isIconOnly
                size="sm"
                variant="flat"
                isDisabled={qty === 0}
                aria-label={`Retirer ${opt.name}`}
                onPress={() => setOptionQuantity(group.name, opt.name, -1)}
              >
                <Minus className="size-3.5" />
              </Button>
              <span className="w-5 text-center text-sm font-medium">{qty}</span>
              <Button
                isIconOnly
                size="sm"
                variant="flat"
                isDisabled={!canIncrement}
                aria-label={`Ajouter ${opt.name}`}
                onPress={() => setOptionQuantity(group.name, opt.name, 1)}
              >
                <Plus className="size-3.5" />
              </Button>
            </div>
          </div>
        );
      })}
      {Number.isFinite(max) && (
        <p className="text-right text-xs text-foreground/50">
          {count} / {max} sélectionné(s)
        </p>
      )}
    </div>
  );
}
