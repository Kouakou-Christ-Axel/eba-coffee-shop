'use client';

import { ArrowLeft, Check, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { type CartItem } from '@/lib/cart-store';
import { type MenuCategory } from '@/config/menu';
import { ProductCatalog } from '../caisse/new/product-catalog';
import { SupplementPicker } from '../caisse/new/supplement-picker';
import { OrderItemRow } from './order-items/order-item-row';
import { fmt } from './order-items/helpers';
import { useOrderItemsEditor } from './order-items/use-order-items-editor';

type Props = {
  orderId: string;
  initialItems: CartItem[];
  menu: MenuCategory[];
  /** Stock déjà réservé (`Order.stockReservedAt`) : retirer un article le rend au stock, sauf s'il était déjà préparé (demandé au staff). */
  stockReserved?: boolean;
  /** Appelé après une sauvegarde réussie ou une annulation. */
  onClose: () => void;
};

/**
 * Panneau d'édition des articles d'une commande : quantités, retraits, ajout de produits via le catalogue et correction
 * des options d'une ligne existante. Toute ligne ajoutée ici est marquée `addedLater` (badge « Ajout »).
 * Sans coquille (ni Card ni Modal) : le parent fournit le conteneur.
 */
export function OrderItemsEditor({
  orderId,
  initialItems,
  menu,
  stockReserved = false,
  onClose,
}: Props) {
  const editor = useOrderItemsEditor({
    orderId,
    initialItems,
    menu,
    stockReserved,
    onClose,
  });
  const {
    items,
    view,
    setView,
    picker,
    setPicker,
    isPending,
    error,
    applyRestock,
    confirmDialog,
    shortageDialog,
    handleProductTap,
    handlePickerConfirm,
    save,
    total,
    sourceItem,
  } = editor;
  const liveMenu = editor.menu;

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
          menu={liveMenu}
          onProductTap={handleProductTap}
          onOpenOptions={(product) => setPicker({ mode: 'add', product })}
        />
        {supplementPicker}
        {confirmDialog}
        {shortageDialog}
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

      {items.map((item) => (
        <OrderItemRow key={item.cartId} item={item} editor={editor} />
      ))}

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
      {shortageDialog}
    </div>
  );
}
