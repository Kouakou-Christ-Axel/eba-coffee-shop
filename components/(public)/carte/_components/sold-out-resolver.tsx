'use client';

// components/(public)/carte/_components/sold-out-resolver.tsx
//
// Panneau « Résoudre » : ouvert quand le serveur refuse la commande parce
// qu'un article s'est épuisé entre l'ajout au panier et la validation
// (409 `SOLD_OUT_TODAY`, voir app/api/commandes/route.ts). Principe : jamais
// un mur, toujours un choix — chaque ligne fautive propose, dans cet ordre :
//   1. REMPLACER (mis en avant : le client garde un retrait aujourd'hui) —
//      2-3 alternatives en stock (`selectReplacementProducts`), ou « Changer
//      de goût » quand seul un goût manque ;
//   2. garder la quantité encore disponible, si le stock n'est que court ;
//   3. retirer la ligne.
// Et, pour tout le panier : « Tout garder, retrait demain ».
//
// Chargé via `next/dynamic` par checkout-form.tsx : rien de ce code n'entre
// dans le chunk initial de la page de commande.

import dynamic from 'next/dynamic';
import { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Chip,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Skeleton,
} from '@heroui/react';
import { CalendarClock, Check, Plus, RefreshCw, Trash2 } from 'lucide-react';
import type { CartItem, CartItemDraft } from '@/lib/cart-store';
import type { SoldOutLine } from '@/lib/schemas/order';
import { priceFormatter, type MenuCategory, type Product } from '@/config/menu';
import { formatSupplementLabel } from '@/lib/orders/format';
import { selectReplacementProducts } from '@/lib/replacements';
import { ProductMedia } from './product-media';
import { useQuickAdd, type QuickAddSink } from './use-quick-add';

const SupplementModal = dynamic(
  () => import('@/components/(public)/carte/supplement-modal'),
  { ssr: false }
);

export type SoldOutResolverProps = {
  isOpen: boolean;
  onClose: () => void;
  /** Lignes refusées par le serveur (toutes, résolues ou non). */
  lines: SoldOutLine[];
  /** Panier courant : une ligne remplacée/retirée en disparaît, c'est ce qui
   * la marque comme résolue. */
  items: CartItem[];
  onReplace: (
    cartId: string,
    item: CartItemDraft,
    quantity: number,
    maxQuantity: number | undefined
  ) => void;
  onReduce: (cartId: string, quantity: number) => void;
  onRemove: (cartId: string) => void;
  /** Garde les lignes restantes telles quelles, retrait reporté à demain. */
  onDeferAll: (cartIds: string[]) => void;
  /** Renvoie la commande une fois tout résolu. */
  onSubmit: () => void;
  isSubmitting: boolean;
};

/** Menu frais (stock compris) chargé à l'ouverture du panneau — la page de
 * commande n'embarque pas le menu. `null` = en cours, `[]` = échec. */
function useMenuWhenOpen(isOpen: boolean): MenuCategory[] | null {
  const [menu, setMenu] = useState<MenuCategory[] | null>(null);
  useEffect(() => {
    if (!isOpen || menu) return;
    let cancelled = false;
    fetch('/api/menu')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: MenuCategory[] | null) => {
        if (!cancelled) setMenu(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!cancelled) setMenu([]);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, menu]);
  return menu;
}

export default function SoldOutResolver({
  isOpen,
  onClose,
  lines,
  items,
  onReplace,
  onReduce,
  onRemove,
  onDeferAll,
  onSubmit,
  isSubmitting,
}: SoldOutResolverProps) {
  const menu = useMenuWhenOpen(isOpen);
  // Lignes dont la quantité a été réduite au stock restant : toujours dans
  // le panier, mais réglées.
  const [reduced, setReduced] = useState<Set<string>>(() => new Set());

  const byCartId = useMemo(
    () => new Map(items.map((i) => [i.cartId, i])),
    [items]
  );
  const pending = lines.filter((l) => {
    const item = byCartId.get(l.cartId);
    return item && !item.soldOutToday && !reduced.has(l.cartId);
  });
  const resolved = pending.length === 0;
  const productIdsInCart = items.map((i) => i.productId);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      placement="auto"
      size="lg"
      scrollBehavior="inside"
    >
      <ModalContent>
        <ModalHeader className="flex flex-col gap-1">
          {resolved ? 'C’est réglé' : 'Victime de son succès'}
          <span className="text-sm font-normal text-foreground/60">
            {resolved
              ? 'Ton panier est à jour, tu peux valider ta commande.'
              : pending.length > 1
                ? 'Ces articles viennent d’être épuisés. Choisis comment continuer — ta commande n’est pas perdue.'
                : 'Cet article vient d’être épuisé. Choisis comment continuer — ta commande n’est pas perdue.'}
          </span>
        </ModalHeader>

        <ModalBody className="gap-4">
          {pending.map((line) => {
            const item = byCartId.get(line.cartId)!;
            return (
              <ResolveRow
                key={line.cartId}
                line={line}
                item={item}
                menu={menu}
                productIdsInCart={productIdsInCart}
                onReplace={onReplace}
                onReduce={(qty) => {
                  onReduce(line.cartId, qty);
                  setReduced((prev) => new Set(prev).add(line.cartId));
                }}
                onRemove={() => onRemove(line.cartId)}
              />
            );
          })}

          {resolved && (
            <p className="flex items-center gap-2 rounded-xl bg-success-50 px-3 py-2.5 text-sm text-success-700">
              <Check className="h-4 w-4 shrink-0" aria-hidden="true" />
              Tout est prêt pour un retrait aujourd’hui.
            </p>
          )}
        </ModalBody>

        <ModalFooter className="flex-col gap-2 sm:flex-col">
          {resolved ? (
            <Button
              color="primary"
              size="lg"
              className="w-full"
              isLoading={isSubmitting}
              onPress={onSubmit}
            >
              Valider ma commande
            </Button>
          ) : (
            <Button
              variant="bordered"
              size="lg"
              className="w-full"
              startContent={
                <CalendarClock className="h-4 w-4" aria-hidden="true" />
              }
              onPress={() => onDeferAll(pending.map((l) => l.cartId))}
            >
              Tout garder, retrait à partir de demain
            </Button>
          )}
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

// ─── Une ligne à résoudre ────────────────────────────────────────────────────

function ResolveRow({
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
  onReplace: SoldOutResolverProps['onReplace'];
  onReduce: (quantity: number) => void;
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

        {canReduce && (
          <Button
            variant="flat"
            size="sm"
            className="mt-2 min-h-9"
            onPress={() => onReduce(line.remaining!)}
          >
            Garder les {line.remaining} disponibles
          </Button>
        )}
      </div>
    </section>
  );
}

// ─── Carte d'alternative ─────────────────────────────────────────────────────

function ReplacementCard({
  product,
  quantity,
  sink,
}: {
  product: Product;
  quantity: number;
  sink: QuickAddSink;
}) {
  const { hasOptions, isModalOpen, closeModal, handleAdd } = useQuickAdd(
    product,
    { sink, quantity }
  );

  return (
    <>
      <button
        type="button"
        onClick={handleAdd}
        aria-label={`Remplacer par ${product.name}`}
        className="w-28 shrink-0 cursor-pointer snap-start text-left"
      >
        <div className="relative h-24 w-28 overflow-hidden rounded-xl">
          <ProductMedia
            product={product}
            sizes="112px"
            monogramClassName="text-3xl"
          />
          <span className="absolute bottom-1.5 right-1.5 flex h-8 w-8 items-center justify-center rounded-full bg-white text-primary shadow-md">
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          </span>
        </div>
        <p className="mt-1.5 truncate text-xs font-medium text-foreground">
          {product.name}
        </p>
        <p className="text-xs font-semibold text-primary">
          {priceFormatter.format(product.price)}&nbsp;F
        </p>
      </button>

      {hasOptions && (
        <SupplementModal
          product={product}
          isOpen={isModalOpen}
          onClose={closeModal}
          initialQuantity={quantity}
          strictStock
          onConfirm={sink}
        />
      )}
    </>
  );
}
