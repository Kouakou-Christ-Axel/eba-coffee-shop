'use client';

import { useMemo, useState, useTransition } from 'react';
import {
  ArrowLeft,
  Check,
  Copy,
  Minus,
  Plus,
  SlidersHorizontal,
  Trash2,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { CartItem, CartItemSupplement } from '@/lib/cart-store';
import type { MenuCategory, Product } from '@/config/menu';
import {
  computeItemsTotal,
  getItemGross,
  getItemNet,
  getMaxItemDiscount,
} from '@/lib/orders/totals';
import { formatSupplementLabel } from '@/lib/orders/format';
import { productHasOptions, productNeedsPicker } from '@/lib/catalog';
import { useLiveMenu } from '@/lib/hooks/use-live-menu';
import { updateOrderItemsAction } from '../commandes/actions';
import { ProductCatalog } from '../caisse/new/product-catalog';
import { SupplementPicker } from '../caisse/new/supplement-picker';
import { LineDiscountControl } from './line-discount-control';
import { useConfirmDialog } from './use-confirm-dialog';

type Props = {
  orderId: string;
  initialItems: CartItem[];
  menu: MenuCategory[];
  /**
   * La commande a-t-elle déjà réservé son stock (`Order.stockReservedAt`) ?
   * Si oui, retirer un article le REND au stock — sauf s'il était déjà
   * préparé, ce qu'on demande alors explicitement au staff.
   */
  stockReserved?: boolean;
  /** Appelé après une sauvegarde réussie ou une annulation. */
  onClose: () => void;
};

type PickerState =
  | { mode: 'add'; product: Product }
  | { mode: 'edit'; product: Product; cartId: string }
  | { mode: 'duplicate'; product: Product; cartId: string };

function makeCartId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function supplementsKey(supplements: CartItemSupplement[]): string {
  return JSON.stringify(
    supplements
      .map(
        (s) => `${s.groupName}:${s.optionName}:${s.price}:${s.quantity ?? 1}`
      )
      .sort()
  );
}

const fmt = new Intl.NumberFormat('fr-FR');

/**
 * Panneau d'édition des articles d'une commande : modifier les quantités,
 * retirer des lignes, **ajouter** de nouveaux produits via le catalogue, et
 * **corriger les options** (suppléments) d'une ligne existante.
 * Toute ligne ajoutée ici est marquée `addedLater` (badge « Ajout »).
 *
 * Composant sans coquille (ni Card ni Modal) : le parent fournit le conteneur.
 */
export function OrderItemsEditor({
  orderId,
  initialItems,
  menu: initialMenu,
  stockReserved = false,
  onClose,
}: Props) {
  const [items, setItems] = useState<CartItem[]>(initialItems);
  const [view, setView] = useState<'list' | 'catalog'>('list');
  const [picker, setPicker] = useState<PickerState | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // Menu « live » : une réappro (goût recrédité) faite ici ou ailleurs se
  // reflète dans le catalogue et le sélecteur sans recharger.
  const { menu, applyRestock } = useLiveMenu(initialMenu);
  const { confirm, confirmDialog } = useConfirmDialog();

  // Index produit par id, pour retrouver les groupes de suppléments d'une
  // ligne (les lignes ne stockent que les options choisies, pas les groupes).
  const productById = useMemo(() => {
    const map = new Map<string, Product>();
    for (const cat of menu) for (const p of cat.products) map.set(p.id, p);
    return map;
  }, [menu]);

  function changeQty(cartId: string, delta: number) {
    setItems((prev) =>
      prev
        .map((i) =>
          i.cartId === cartId ? { ...i, quantity: i.quantity + delta } : i
        )
        .filter((i) => i.quantity > 0)
    );
  }

  function removeItem(cartId: string) {
    setItems((prev) => prev.filter((i) => i.cartId !== cartId));
  }

  function setItemDiscount(
    cartId: string,
    discount: number,
    reason: string | null
  ) {
    setItems((prev) =>
      prev.map((i) =>
        i.cartId === cartId ? { ...i, discount, discountReason: reason } : i
      )
    );
  }

  // Ajout : toujours une nouvelle ligne `addedLater` (jamais fusionnée avec
  // une ligne d'origine). Re-taper le même produit ajouté incrémente sa ligne.
  function addLine(product: Product, supplements: CartItemSupplement[]) {
    setItems((prev) => {
      const key = supplementsKey(supplements);
      const existing = prev.find(
        (i) =>
          i.addedLater &&
          i.productId === product.id &&
          supplementsKey(i.supplements) === key
      );
      if (existing) {
        return prev.map((i) =>
          i.cartId === existing.cartId ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      const item: CartItem = {
        cartId: makeCartId(),
        productId: product.id,
        productName: product.name,
        basePrice: product.price,
        coutMatiere: product.coutMatiere ?? 0,
        coutEmballage: product.coutEmballage ?? 0,
        quantity: 1,
        supplements,
        addedLater: true,
      };
      return [...prev, item];
    });
  }

  // Même règle que la saisie caisse : le sélecteur ne s'ouvre que si le produit
  // impose un choix. Les extras globaux, présents sur TOUS les produits depuis
  // `getMenu()`, sont atteints par le bouton « Options » de la tuile.
  function handleProductTap(product: Product) {
    if (productNeedsPicker(product)) {
      setPicker({ mode: 'add', product });
      return;
    }
    addLine(product, []);
    setView('list');
  }

  function editLineOptions(item: CartItem) {
    const product = productById.get(item.productId);
    if (!product) return;
    setPicker({ mode: 'edit', product, cartId: item.cartId });
  }

  // Ajoute UN exemplaire de plus de ce produit, avec des suppléments qu'on
  // peut choisir différents de la ligne d'origine (ex. 2 crêpes dont une
  // seule avec chantilly) — au contraire de `changeQty` qui applique
  // toujours les MÊMES suppléments à toute la ligne. Le sélecteur est
  // pré-rempli avec les suppléments actuels de la ligne, éditables ; `addLine`
  // fusionne ensuite automatiquement avec une ligne existante si le résultat
  // est identique, ou crée une ligne séparée sinon.
  function duplicateLineWithOptions(item: CartItem) {
    const product = productById.get(item.productId);
    if (!product) return;
    setPicker({ mode: 'duplicate', product, cartId: item.cartId });
  }

  function handlePickerConfirm(
    product: Product,
    supplements: CartItemSupplement[]
  ) {
    if (picker?.mode === 'edit') {
      const { cartId } = picker;
      setItems((prev) =>
        prev.map((i) => (i.cartId === cartId ? { ...i, supplements } : i))
      );
    } else {
      addLine(product, supplements);
      if (picker?.mode === 'add') setView('list');
    }
    setPicker(null);
  }

  /** Articles/quantités retirés par rapport au contenu d'origine. */
  function hasRemovedSomething(): boolean {
    const nextByProduct = new Map<string, number>();
    for (const i of items) {
      nextByProduct.set(
        i.productId,
        (nextByProduct.get(i.productId) ?? 0) + i.quantity
      );
    }
    const prevByProduct = new Map<string, number>();
    for (const i of initialItems) {
      prevByProduct.set(
        i.productId,
        (prevByProduct.get(i.productId) ?? 0) + i.quantity
      );
    }
    for (const [productId, before] of prevByProduct) {
      if ((nextByProduct.get(productId) ?? 0) < before) return true;
    }
    return false;
  }

  async function save() {
    if (items.length === 0) {
      setError('La commande doit contenir au moins un article');
      return;
    }
    setError(null);

    // Un article retiré d'une commande DÉJÀ PARTIE EN CUISINE revient au stock
    // par défaut : il n'a pas été consommé, le garder décompté ferait mentir le
    // stock et bloquerait une vente réelle. Mais il a pu être préparé — seule
    // la personne devant l'écran le sait, on lui demande.
    let restoreRemovedStock = true;
    if (stockReserved && hasRemovedSomething()) {
      restoreRemovedStock = await confirm({
        title: 'Remettre en stock ?',
        message:
          'Cette commande est déjà partie en cuisine. Les articles retirés ont-ils déjà été préparés ?\n\n' +
          '« Remettre en stock » les rend vendables ; « Déjà préparé » les laisse décomptés.',
        confirmLabel: 'Remettre en stock',
        cancelLabel: 'Déjà préparé',
      });
    }

    startTransition(async () => {
      try {
        const result = await updateOrderItemsAction(orderId, items, {
          restoreRemovedStock,
        });
        if (result?.error) {
          setError(result.error);
          return;
        }
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erreur');
      }
    });
  }

  const total = computeItemsTotal(items);

  // 'edit' ET 'duplicate' pré-remplissent depuis la même ligne source (l'un la
  // modifie sur place, l'autre s'en sert de point de départ pour un NOUVEL
  // exemplaire) — seul 'add' (depuis le catalogue) part de zéro.
  const sourceItem =
    picker?.mode === 'edit' || picker?.mode === 'duplicate'
      ? items.find((i) => i.cartId === picker.cartId)
      : undefined;

  const supplementPicker = (
    <SupplementPicker
      product={picker?.product ?? null}
      isOpen={picker !== null}
      onClose={() => setPicker(null)}
      onAdd={({ product, supplements }) =>
        handlePickerConfirm(product, supplements)
      }
      initialSupplements={sourceItem?.supplements ?? []}
      editToken={picker?.mode !== 'add' ? picker?.cartId : undefined}
      confirmVerb={picker?.mode === 'edit' ? 'Mettre à jour' : 'Ajouter'}
      onRestocked={(groupName, optionName, stock) => {
        if (!picker) return;
        applyRestock(
          {
            target: 'option',
            productId: picker.product.id,
            groupName,
            optionName,
          },
          stock
        );
      }}
    />
  );

  if (view === 'catalog') {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setView('list')}
            className="gap-1.5"
          >
            <ArrowLeft className="size-4" /> Retour
          </Button>
          <span className="text-sm text-muted-foreground">
            Touchez un produit pour l&apos;ajouter
          </span>
        </div>
        <ProductCatalog
          menu={menu}
          onProductTap={handleProductTap}
          onOpenOptions={(product) => setPicker({ mode: 'add', product })}
        />
        {supplementPicker}
        {confirmDialog}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-base font-semibold">Modifier les articles</span>
        <div className="flex gap-1.5">
          <Button
            size="sm"
            onClick={save}
            disabled={isPending || items.length === 0}
            className="gap-1"
          >
            <Check className="size-3.5" /> Enregistrer
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={isPending}
            className="gap-1"
          >
            <X className="size-3.5" /> Annuler
          </Button>
        </div>
      </div>

      {items.map((item) => {
        const lineProduct = productById.get(item.productId);
        const hasOptions =
          lineProduct !== undefined && productHasOptions(lineProduct);
        const gross = getItemGross(item);
        const net = getItemNet(item);
        const discounted = gross !== net;
        return (
          <div key={item.cartId} className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 text-sm font-medium">
                <span className="truncate">{item.productName}</span>
                {item.addedLater && (
                  <span className="shrink-0 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                    Ajout
                  </span>
                )}
              </p>
              {item.supplements.length > 0 && (
                <p className="truncate text-xs text-muted-foreground">
                  {item.supplements.map(formatSupplementLabel).join(', ')}
                </p>
              )}
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                <LineDiscountControl
                  maxDiscount={getMaxItemDiscount(item)}
                  discount={item.discount ?? 0}
                  reason={item.discountReason ?? null}
                  onChange={(d, r) => setItemDiscount(item.cartId, d, r)}
                  disabled={isPending}
                />
                {hasOptions && (
                  <button
                    type="button"
                    onClick={() => editLineOptions(item)}
                    disabled={isPending}
                    className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted disabled:opacity-40"
                  >
                    <SlidersHorizontal className="size-3.5" /> Options
                  </button>
                )}
                {hasOptions && (
                  <button
                    type="button"
                    onClick={() => duplicateLineWithOptions(item)}
                    disabled={isPending}
                    title="Ajouter un exemplaire avec des suppléments différents"
                    className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted disabled:opacity-40"
                  >
                    <Copy className="size-3.5" /> Dupliquer
                  </button>
                )}
              </div>
              {item.discountReason && (
                <p className="mt-0.5 text-[11px] italic text-muted-foreground">
                  Motif : {item.discountReason}
                </p>
              )}
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => changeQty(item.cartId, -1)}
                  disabled={isPending}
                >
                  {item.quantity === 1 ? (
                    <Trash2 className="size-3.5 text-destructive" />
                  ) : (
                    <Minus className="size-3.5" />
                  )}
                </Button>
                <span className="w-6 text-center text-sm font-medium">
                  {item.quantity}
                </span>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => changeQty(item.cartId, 1)}
                  disabled={isPending}
                >
                  <Plus className="size-3.5" />
                </Button>
              </div>
              <span className="text-right text-sm">
                {discounted && (
                  <span className="mr-1 text-xs text-muted-foreground line-through">
                    {fmt.format(gross)}
                  </span>
                )}
                <span
                  className={
                    discounted
                      ? 'font-semibold text-green-700 dark:text-green-400'
                      : ''
                  }
                >
                  {fmt.format(net)} F
                </span>
              </span>
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => removeItem(item.cartId)}
              disabled={isPending}
              aria-label="Supprimer"
              className="mt-0.5"
            >
              <Trash2 className="size-3.5 text-destructive" />
            </Button>
          </div>
        );
      })}

      {items.length === 0 && (
        <p className="text-sm text-destructive">
          La commande doit contenir au moins un article.
        </p>
      )}

      <Button
        variant="outline"
        size="sm"
        onClick={() => setView('catalog')}
        disabled={isPending}
        className="w-full gap-1.5 border-dashed"
      >
        <Plus className="size-3.5" /> Ajouter un produit
      </Button>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="border-t pt-2 text-right text-sm font-bold">
        Total : {fmt.format(total)} FCFA
      </div>

      {supplementPicker}
      {confirmDialog}
    </div>
  );
}
