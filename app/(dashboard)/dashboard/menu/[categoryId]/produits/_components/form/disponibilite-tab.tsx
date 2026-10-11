'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { TabsContent } from '@/components/ui/tabs';
import { Field } from './form-field';
import { PauseField } from '../pause-field';
import { WeeklySpecialField } from '../weekly-special-field';
import {
  ScheduleField,
  type ScheduleOption,
} from '@/components/(dashboard)/schedule-field';
import {
  ADVANCE_ORDER_DAYS_MAX,
  MIN_DEPOSIT_PERCENT,
} from '@/config/constants';
import type { ProductFormState } from './use-product-form';
import type { ProductFormInitial } from './types';

export function DisponibiliteTab({
  form,
  schedules,
  initial,
}: {
  form: ProductFormState;
  schedules: ScheduleOption[];
  initial?: ProductFormInitial;
}) {
  const {
    isEdit,
    scheduleId,
    setScheduleId,
    advanceOrderDays,
    setAdvanceOrderDays,
    requiresDeposit,
    setRequiresDeposit,
  } = form;
  return (
    <TabsContent value="disponibilite" className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Quand ce produit est-il commandable ?
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ScheduleField
            schedules={schedules}
            scheduleId={scheduleId}
            onChange={setScheduleId}
            helpText="Restreint la commande aux jours du planning (combiné avec celui de la catégorie si elle en a un)."
          />
          <Field
            id="advance-order-days"
            label="Commande à l'avance (jours)"
            help="Délai minimum entre la commande et le retrait. Vide = pas de contrainte. Combiné avec celui de la catégorie (le plus grand des deux s'applique)."
          >
            <Input
              id="advance-order-days"
              type="number"
              min={1}
              max={ADVANCE_ORDER_DAYS_MAX}
              step={1}
              placeholder="Aucun"
              value={advanceOrderDays ?? ''}
              onChange={(e) =>
                setAdvanceOrderDays(
                  e.target.value === '' ? null : Number(e.target.value)
                )
              }
            />
          </Field>
          <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
            <div>
              <Label htmlFor="requires-deposit">
                Commande spéciale — acompte requis
              </Label>
              <p className="text-xs text-muted-foreground">
                Ex. gâteau grand format. Un acompte minimum de{' '}
                {MIN_DEPOSIT_PERCENT}% sera exigé avant l&apos;entrée en
                cuisine.
              </p>
            </div>
            <Switch
              id="requires-deposit"
              checked={requiresDeposit}
              onCheckedChange={setRequiresDeposit}
            />
          </div>
        </CardContent>
      </Card>

      {isEdit && initial?.id ? (
        <>
          <PauseField
            productId={initial.id}
            initialUnavailableUntil={initial.unavailableUntil}
          />
          <WeeklySpecialField
            productId={initial.id}
            initialSpecials={initial.weeklySpecials}
          />
        </>
      ) : (
        <p className="text-sm text-muted-foreground">
          La pause programmée et les semaines spéciales seront disponibles une
          fois le produit créé.
        </p>
      )}
    </TabsContent>
  );
}
