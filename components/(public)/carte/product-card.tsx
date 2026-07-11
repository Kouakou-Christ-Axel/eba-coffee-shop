// components/(public)/carte/product-card.tsx
'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { MediaImage as Image } from '@/components/ui/media-image';
import { Button, Chip } from '@heroui/react';
import { Check, Plus } from 'lucide-react';
import { useCartStore } from '@/lib/cart-store';
import { priceFormatter, type Product } from '@/config/menu';
import { isPausedNow } from '@/lib/supplements';
import { LOW_STOCK_THRESHOLD } from '@/config/constants';
import {
  formatAbidjanShortDate,
  formatAbidjanTime,
  formatLocalDateOnly,
} from '@/lib/timezone';

/** « Indisponible — retour {…} » : juste l'heure si la reprise tombe
 * aujourd'hui (Abidjan), sinon date courte + heure — reste lisible dans un
 * chip étroit. */
function formatResumeLabel(unavailableUntil: string): string {
  const until = new Date(unavailableUntil);
  const isToday =
    formatLocalDateOnly(until) === formatLocalDateOnly(new Date());
  return isToday
    ? formatAbidjanTime(until)
    : `${formatAbidjanShortDate(until)} · ${formatAbidjanTime(until)}`;
}

// Lazy-load the supplement modal — it's only opened when a product has
// supplements AND the user clicks "add". Avoids shipping HeroUI Modal +
// RadioGroup/Checkbox to first paint of the menu.
const SupplementModal = dynamic(
  () => import('@/components/(public)/carte/supplement-modal'),
  { ssr: false }
);

type ProductCardProps = {
  product: Product;
};

function ProductCard({ product }: ProductCardProps) {
  const { addItem } = useCartStore();
  const [showModal, setShowModal] = useState(false);
  const [justAdded, setJustAdded] = useState(false);
  const hasSups = product.supplements && product.supplements.length > 0;

  // Priorité d'affichage : pause > épuisé > stock bas > rien (illimité/stock
  // confortable). Pause et épuisé désactivent l'ajout ; stock bas reste une
  // simple info (le prochain « Épuisé » viendra tout seul à 0).
  const paused = isPausedNow(product.unavailableUntil);
  const soldOut = !paused && product.soldOut === true;
  const lowStock =
    !paused &&
    !soldOut &&
    product.remaining != null &&
    product.remaining > 0 &&
    product.remaining <= LOW_STOCK_THRESHOLD;
  const isUnorderable = paused || soldOut;

  function handleAdd() {
    if (isUnorderable) return;
    if (hasSups) {
      setShowModal(true);
    } else {
      addItem(
        {
          productId: product.id,
          productName: product.name,
          basePrice: product.price,
          coutMatiere: product.coutMatiere ?? 0,
          coutEmballage: product.coutEmballage ?? 0,
          supplements: [],
        },
        product.remaining ?? undefined
      );
      setJustAdded(true);
      setTimeout(() => setJustAdded(false), 1200);
    }
  }

  return (
    <>
      <div
        onClick={isUnorderable ? undefined : handleAdd}
        className={`group flex items-center gap-4 rounded-2xl border border-foreground/5 bg-white/60 p-3 transition-colors duration-200 hover:border-primary/10 hover:bg-white/80 sm:p-4 ${
          isUnorderable ? '' : 'cursor-pointer'
        }`}
      >
        {/* Image */}
        {product.image ? (
          <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl sm:h-24 sm:w-24">
            <Image
              src={product.image}
              alt={product.name}
              fill
              sizes="96px"
              className="object-cover"
            />
          </div>
        ) : (
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl bg-foreground/[0.03] sm:h-24 sm:w-24">
            <span className="text-2xl text-foreground/15">
              {product.name.charAt(0)}
            </span>
          </div>
        )}

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold tracking-tight text-foreground sm:text-base">
            {product.name}
          </p>
          <p className="mt-0.5 text-xs text-foreground/50 sm:text-sm">
            {product.description}
          </p>
          <p className="mt-1.5 text-sm font-semibold text-primary">
            {priceFormatter.format(product.price)}&nbsp;F
          </p>

          {(paused || soldOut || lowStock) && (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {paused && (
                <Chip color="warning" variant="flat" size="sm">
                  Indisponible — retour{' '}
                  {formatResumeLabel(product.unavailableUntil as string)}
                </Chip>
              )}
              {soldOut && (
                <Chip color="danger" variant="flat" size="sm">
                  Épuisé
                </Chip>
              )}
              {lowStock && (
                <Chip color="secondary" variant="flat" size="sm">
                  Plus que {product.remaining}
                </Chip>
              )}
            </div>
          )}
        </div>

        {/* Add button */}
        <Button
          isIconOnly
          size="sm"
          color={justAdded ? 'success' : 'primary'}
          variant="flat"
          radius="full"
          isDisabled={isUnorderable}
          aria-label={
            isUnorderable
              ? `${product.name} indisponible`
              : `Ajouter ${product.name}`
          }
          onPress={handleAdd}
          onClick={(e) => e.stopPropagation()}
          className="shrink-0 cursor-pointer transition-transform duration-150 active:scale-90 hover:scale-110 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100"
        >
          {justAdded ? (
            <Check className="h-4 w-4" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
        </Button>
      </div>

      {hasSups && (
        <SupplementModal
          product={product}
          isOpen={showModal}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  );
}

export default ProductCard;
