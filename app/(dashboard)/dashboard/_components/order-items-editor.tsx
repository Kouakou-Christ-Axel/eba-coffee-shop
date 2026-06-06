'use client';

import { useMemo, useState, useTransition } from 'react';
import {
  ArrowLeft,
  Check,
  Minus,
  Plus,
  SlidersHorizontal,
  Trash2,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { CartItem, CartItemSupplement } from '@/lib/cart-store';
import type { MenuCategory, Product } from '@/config/menu';
import { updateOrderItemsAction } from '../commandes/actions';
import { ProductCatalog } from '../caisse/new/product-catalog';
import { SupplementPicker } from '../caisse/new/supplement-picker';

type Props = {
  orderId: string;
  initialItems: CartItem[];
  menu: MenuCategory[];
  /** Appelé après une sauvegarde réussie ou une annulation. */
  onClose: () => void;
};

type PickerState =
  | { mode: 'add'; product: Product }
  | { mode: 'edit'; product: Product; cartId: string };

function makeCartId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function supplementsKey(supplements: CartItemSupplement[]): string {
  return JSON.stringify(
    supplements.map((s) => `${s.groupName}:${s.optionName}:${s.price}`).sort()
  );
}

function lineTotal(item: CartItem): number {
  return (
    (item.basePrice + item.supplements.reduce((s, sup) => s + sup.price, 0)) *
    item.quantity
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
  menu,
  onClose,
}: Props) {
  const [items, setItems] = useState<CartItem[]>(initialItems);
  const [view, setView] = useState<'list' | 'catalog'>('list');
  const [picker, setPicker] = useState<PickerState | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

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

  function handleProductTap(product: Product) {
    if ((product.supplements?.length ?? 0) > 0) {
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
      setView('list');
    }
    setPicker(null);
  }

  function save() {
    if (items.length === 0) {
      setError('La commande doit contenir au moins un article');
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await updateOrderItemsAction(orderId, items);
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erreur');
      }
    });
  }

  const total = items.reduce((sum, item) => sum + lineTotal(item), 0);

  const editingItem =
    picker?.mode === 'edit'
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
      initialSupplements={editingItem?.supplements ?? []}
      editToken={picker?.mode === 'edit' ? picker.cartId : undefined}
      confirmVerb={picker?.mode === 'edit' ? 'Mettre à jour' : 'Ajouter'}
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
        <ProductCatalog menu={menu} onProductTap={handleProductTap} />
        {supplementPicker}
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
        const hasOptions =
          (productById.get(item.productId)?.supplements?.length ?? 0) > 0;
        return (
          <div key={item.cartId} className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 truncate text-sm font-medium">
                <span className="truncate">{item.productName}</span>
                {item.addedLater && (
                  <span className="shrink-0 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                    Ajout
                  </span>
                )}
              </p>
              {item.supplements.length > 0 && (
                <p className="truncate text-xs text-muted-foreground">
                  {item.supplements.map((s) => s.optionName).join(', ')}
                </p>
              )}
            </div>
            {hasOptions && (
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => editLineOptions(item)}
                disabled={isPending}
                aria-label="Modifier les options"
                title="Modifier les options"
              >
                <SlidersHorizontal className="size-3.5" />
              </Button>
            )}
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
            <span className="w-20 text-right text-sm">
              {fmt.format(lineTotal(item))} F
            </span>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => removeItem(item.cartId)}
              disabled={isPending}
              aria-label="Supprimer"
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
    </div>
  );
}
