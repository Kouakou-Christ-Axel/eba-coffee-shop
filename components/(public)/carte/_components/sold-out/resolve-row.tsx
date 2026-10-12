'use client';

import { useMemo, useState } from 'react';
import { Button, Chip, Skeleton } from '@heroui/react';
import { RefreshCw, Trash2 } from 'lucide-react';
import type { CartItem } from '@/lib/cart-store';
import type { SoldOutLine } from '@/lib/schemas/order';
import type { MenuCategory } from '@/config/menu';
import { formatSupplementLabel } from '@/lib/orders/format';
import { selectReplacementProducts } from '@/lib/replacements';
import type { QuickAddSink } from '../use-quick-add';
import { RestockAlertButton, SupplementModal } from './lazy';
import { ReplacementCard } from './replacement-card';
import type { ReplaceHandler } from './types';

// ─── Une ligne à résoudre ────────────────────────────────────────────────────

export function ResolveRow({
  line,
  item,
  menu,
  productIdsInCart,
  onReplace,
  onReduce,
  onRemove,
}: {
  line: SoldOutLine;
  item: CartItem;
  menu: MenuCategory[] | null;
  productIdsInCart: string[];
  onReplace: ReplaceHandler;
  onReduce?: (quantity: number) => void;
  onRemove: () => void;
}) {
  const [flavourOpen, setFlavourOpen] = useState(false);
  const sink: QuickAddSink = (draft, quantity, max) =>
    onReplace(line.cartId, draft, quantity, max);

  const product =
    menu?.flatMap((c) => c.products).find((p) => p.id === line.productId) ??
    null;
  // Seul un goût manque, le produit est là : on propose de changer de goût
  // plutôt que de changer de produit.
  const flavourOnly =
    !line.missingProduct &&
    line.missingOptionNames.length > 0 &&
    product != null &&
    product.soldOut !== true;
  // Stock court mais pas nul : garder ce qui reste est une vraie option.
  const canReduce =
    onReduce !== undefined &&
    line.missingProduct &&
    line.missingOptionNames.length === 0 &&
    line.remaining != null &&
    line.remaining > 0 &&
    line.remaining < item.quantity;

  const replacements = useMemo(
    () =>
      menu && !flavourOnly
        ? selectReplacementProducts(menu, item, {
            excludeProductIds: productIdsInCart,
          })
        : [],
    [menu, flavourOnly, item, productIdsInCart]
  );

  // Cible de l'alerte « de retour » : le goût manquant s'il est seul en
  // cause (et identifiable dans la ligne), sinon le produit.
  const missingFlavourGroup = flavourOnly
    ? item.supplements.find((s) => s.optionName === line.missingOptionNames[0])
        ?.groupName
    : undefined;
  const alertTarget = missingFlavourGroup
    ? {
        productId: line.productId,
        groupName: missingFlavourGroup,
        optionName: line.missingOptionNames[0],
      }
    : { productId: line.productId };

  const reason = line.missingProduct
    ? canReduce
      ? `Il n’en reste que ${line.remaining}`
      : 'Épuisé aujourd’hui'
    : `${line.missingOptionNames.join(', ')} épuisé${line.missingOptionNames.length > 1 ? 's' : ''}`;

  return (
    <section className="rounded-2xl border border-foreground/10 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">
            {item.quantity}× {item.productName}
          </p>
          {item.supplements.length > 0 && (
            <p className="text-xs text-foreground/45">
              {item.supplements.map(formatSupplementLabel).join(', ')}
            </p>
          )}
          <Chip size="sm" color="warning" variant="flat" className="mt-1.5">
            {reason}
          </Chip>
        </div>
        <Button
          isIconOnly
          variant="light"
          aria-label={`Retirer ${item.productName}`}
          className="h-11 w-11 shrink-0 text-foreground/50"
          onPress={onRemove}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      <div className="mt-3">
        {flavourOnly && product ? (
          <>
            <Button
              color="primary"
              className="w-full"
              startContent={
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
              }
              onPress={() => setFlavourOpen(true)}
            >
              Changer de goût
            </Button>
            <SupplementModal
              product={product}
              isOpen={flavourOpen}
              onClose={() => setFlavourOpen(false)}
              initialSupplements={item.supplements.filter(
                (s) => !line.missingOptionNames.includes(s.optionName)
              )}
              editToken={line.cartId}
              initialQuantity={item.quantity}
              strictStock
              onConfirm={sink}
            />
          </>
        ) : (
          <>
            <p className="text-xs font-semibold text-foreground/60">
              Remplacer par
            </p>
            {menu === null ? (
              <div className="mt-2 flex gap-3">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-36 w-28 rounded-xl" />
                ))}
              </div>
            ) : replacements.length === 0 ? (
              <p className="mt-1 text-sm text-foreground/55">
                Pas d’alternative disponible pour l’instant.
              </p>
            ) : (
              <div className="-mx-1 mt-2 overflow-x-auto px-1 pb-1 scrollbar-none">
                <div className="flex snap-x gap-3">
                  {replacements.map((p) => (
                    <ReplacementCard
                      key={p.id}
                      product={p}
                      quantity={item.quantity}
                      sink={sink}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* Rien ne convient ? Être prévenu du retour de CE qui manque —
            le goût précis s'il n'y a que lui, sinon le produit. */}
        <RestockAlertButton className="mt-2" target={alertTarget} />

        {canReduce && (
          <Button
            variant="flat"
            size="sm"
            className="mt-2 min-h-9"
            onPress={() => onReduce?.(line.remaining!)}
          >
            Garder les {line.remaining} disponibles
          </Button>
        )}
      </div>
    </section>
  );
}
