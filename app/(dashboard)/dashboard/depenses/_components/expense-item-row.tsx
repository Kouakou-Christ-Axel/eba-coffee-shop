'use client';

// Une ligne de détail : rangée compacte (article · qté · PU · montant) et zone
// avancée repliée pour ce qui ne sert qu'occasionnellement (format, unité,
// précision, quantité à compléter).

import { useState } from 'react';
import { ChevronDown, Repeat2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { BASE_UNITS, type BaseUnit } from '@/lib/expense-units';
import {
  willCreateArticle,
  type ExpenseItemDraft,
} from '@/lib/expense-item-draft';
import type { ExpenseArticleOption } from '@/lib/expense-article-search';
import {
  ArticleCombobox,
  NEW_ARTICLE_BADGE_CLASS,
  type ArticlePick,
} from './article-combobox';

const selectClass =
  'h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50';

export function ExpenseItemRow({
  item,
  index,
  articles,
  usedArticleIds,
  onPatch,
  onReplaceArticle,
  onRemove,
  autoFocusQuantity,
}: {
  item: ExpenseItemDraft;
  index: number;
  articles: ExpenseArticleOption[];
  usedArticleIds: ReadonlySet<string>;
  onPatch: (patch: Partial<ExpenseItemDraft>) => void;
  onReplaceArticle: (pick: ArticlePick) => void;
  onRemove: () => void;
  autoFocusQuantity?: boolean;
}) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [replacing, setReplacing] = useState(false);

  const isNewArticle = willCreateArticle(item);

  // Une unité héritée hors référentiel (« sac », « carton ») doit rester
  // sélectionnable, sinon rouvrir une vieille dépense la réécrirait en silence.
  const legacyUnit =
    item.unit && !BASE_UNITS.includes(item.unit as BaseUnit) ? item.unit : null;
  const unitOptions = legacyUnit ? [legacyUnit, ...BASE_UNITS] : BASE_UNITS;

  return (
    <div className="space-y-2 rounded-md border p-2">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          {replacing ? (
            <ArticleCombobox
              articles={articles}
              usedArticleIds={usedArticleIds}
              placeholder="Remplacer par…"
              autoFocus
              clearOnPick={false}
              onCancel={() => setReplacing(false)}
              onPick={(pick) => {
                onReplaceArticle(pick);
                setReplacing(false);
              }}
            />
          ) : (
            <button
              type="button"
              onClick={() => setReplacing(true)}
              className="flex min-h-9 w-full items-center gap-2 rounded-md px-2 text-left hover:bg-accent"
              aria-label={`Changer l’article de la ligne ${index + 1}`}
            >
              <span className="truncate font-medium">{item.rawLabel}</span>
              {isNewArticle && (
                <Badge
                  variant="outline"
                  className={cn('shrink-0', NEW_ARTICLE_BADGE_CLASS)}
                >
                  Nouveau
                </Badge>
              )}
              <Repeat2 className="ml-auto h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            </button>
          )}
        </div>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          onClick={onRemove}
          aria-label={`Retirer la ligne ${index + 1}`}
        >
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Input
          aria-label="Quantité"
          type="number"
          min={0}
          step="any"
          inputMode="decimal"
          autoFocus={autoFocusQuantity}
          value={item.formatQty}
          onChange={(e) => onPatch({ formatQty: e.target.value })}
          placeholder={item.unit ? `Qté (${item.unit})` : 'Qté'}
        />
        <Input
          aria-label="Prix unitaire (FCFA)"
          type="number"
          min={0}
          inputMode="numeric"
          value={item.unitPrice}
          onChange={(e) => onPatch({ unitPrice: e.target.value })}
          placeholder="PU (F)"
          className={cn(item.unitPriceIsSuggestion && 'text-muted-foreground')}
          title={
            item.unitPriceIsSuggestion
              ? 'Prix moyen constaté — ajuste-le si besoin'
              : undefined
          }
        />
        <Input
          aria-label="Montant (FCFA)"
          type="number"
          min={0}
          inputMode="numeric"
          value={item.amount}
          onChange={(e) => onPatch({ amount: e.target.value })}
          placeholder="Montant"
        />
      </div>

      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-7 px-2 text-xs text-muted-foreground"
        onClick={() => setShowAdvanced((v) => !v)}
        aria-expanded={showAdvanced}
      >
        <ChevronDown
          className={cn(
            'mr-1 h-3.5 w-3.5 transition-transform',
            showAdvanced && 'rotate-180'
          )}
        />
        Détails
      </Button>

      {showAdvanced && (
        <div className="space-y-2 border-t pt-2">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <div className="space-y-1">
              <Label
                htmlFor={`item-${index}-size`}
                className="text-xs text-muted-foreground"
              >
                Format
              </Label>
              <Input
                id={`item-${index}-size`}
                type="number"
                min={0}
                step="any"
                inputMode="decimal"
                value={item.formatSize}
                onChange={(e) => onPatch({ formatSize: e.target.value })}
                placeholder="Ex. 25 = sac de 25 kg"
              />
            </div>
            <div className="space-y-1">
              <Label
                htmlFor={`item-${index}-unit`}
                className="text-xs text-muted-foreground"
              >
                Unité
              </Label>
              <select
                id={`item-${index}-unit`}
                className={selectClass}
                value={item.unit}
                onChange={(e) => onPatch({ unit: e.target.value })}
              >
                <option value="">— aucune —</option>
                {unitOptions.map((unit) => (
                  <option key={unit} value={unit}>
                    {unit}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label
                htmlFor={`item-${index}-label`}
                className="text-xs text-muted-foreground"
              >
                Précision
              </Label>
              <Input
                id={`item-${index}-label`}
                value={item.label}
                onChange={(e) => onPatch({ label: e.target.value })}
                placeholder="Ex. bio, marque…"
              />
            </div>
          </div>
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={item.pendingQuantity}
              onChange={(e) => onPatch({ pendingQuantity: e.target.checked })}
            />
            Quantité à renseigner plus tard (montant connu)
          </label>
        </div>
      )}
    </div>
  );
}
