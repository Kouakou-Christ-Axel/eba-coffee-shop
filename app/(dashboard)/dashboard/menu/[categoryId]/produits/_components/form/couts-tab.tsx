'use client';

import { AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { TabsContent } from '@/components/ui/tabs';
import { Field } from './form-field';
import type { ProductFormState } from './use-product-form';

const priceFormatter = new Intl.NumberFormat('fr-FR');

export function CoutsTab({ form }: { form: ProductFormState }) {
  const {
    errors,
    priceNum,
    coutMatiere,
    setCoutMatiere,
    coutMatiereNum,
    coutEmballage,
    setCoutEmballage,
    coutEmballageNum,
    costHint,
    stockQuantity,
    setStockQuantity,
    setStockTouched,
  } = form;
  return (
    <TabsContent value="couts" className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Coûts de revient</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field
              id="cout-matiere"
              label="Coût matière (FCFA)"
              help="Ce que vous coûtent les ingrédients pour une unité."
              error={errors.coutMatiere}
            >
              <Input
                id="cout-matiere"
                type="number"
                min={0}
                step={1}
                placeholder="Ex. 600"
                value={coutMatiere}
                onChange={(e) => setCoutMatiere(e.target.value)}
                aria-invalid={Boolean(errors.coutMatiere)}
              />
            </Field>
            <Field
              id="cout-emballage"
              label="Coût emballage (FCFA)"
              help="Gobelet, boîte, couvercle, serviette… pour une unité."
              error={errors.coutEmballage}
            >
              <Input
                id="cout-emballage"
                type="number"
                min={0}
                step={1}
                placeholder="Ex. 150"
                value={coutEmballage}
                onChange={(e) => setCoutEmballage(e.target.value)}
                aria-invalid={Boolean(errors.coutEmballage)}
              />
            </Field>
          </div>
          {priceNum > 0 && (
            <div className="rounded-lg bg-muted px-3 py-2 text-sm">
              <span className="text-muted-foreground">Marge estimée : </span>
              <span className="font-semibold tabular-nums">
                {priceFormatter.format(
                  priceNum - coutMatiereNum - coutEmballageNum
                )}{' '}
                FCFA
              </span>
              <span className="ml-2 text-muted-foreground tabular-nums">
                (
                {Math.round(
                  ((priceNum - coutMatiereNum - coutEmballageNum) / priceNum) *
                    100
                )}{' '}
                %)
              </span>
            </div>
          )}
          {/* Avertissement, pas erreur : certains produits n'ont réellement aucun coût saisi. */}
          {costHint && (
            <p className="flex items-start gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
              {costHint}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Stock du jour</CardTitle>
        </CardHeader>
        <CardContent>
          <Field
            id="stock-quantity"
            label="Quantité disponible du jour"
            help="Vide = illimité (crêpes, boissons…). Un nombre = suivi et décrémenté à l'entrée en cuisine. Une commande pour un autre jour n'y touche pas."
          >
            <Input
              id="stock-quantity"
              type="number"
              min={0}
              step={1}
              placeholder="Illimité"
              value={stockQuantity ?? ''}
              onChange={(e) => {
                setStockTouched(true);
                setStockQuantity(
                  e.target.value === '' ? null : Number(e.target.value)
                );
              }}
            />
          </Field>
        </CardContent>
      </Card>
    </TabsContent>
  );
}
