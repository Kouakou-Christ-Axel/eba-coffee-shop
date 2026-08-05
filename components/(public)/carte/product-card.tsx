// components/(public)/carte/product-card.tsx
'use client';

import dynamic from 'next/dynamic';
import { Button, Chip } from '@heroui/react';
import { Check, Plus } from 'lucide-react';
import { priceFormatter, type Product } from '@/config/menu';
import { useQuickAdd } from './_components/use-quick-add';
import {
  formatAbidjanShortDate,
  formatAbidjanTime,
  formatLocalDateOnly,
} from '@/lib/timezone';
import {
  ProductBadge,
  ProductMedia,
  productBadgeLabel,
} from './_components/product-media';
import {
  formatAvailableDaysLabel,
  formatWeeklySpecialLabel,
} from './_components/availability-labels';

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
  const {
    hasOptions,
    paused,
    soldOut,
    weeklyGated,
    outOfSchedule,
    lowStock,
    isUnorderable,
    justAdded,
    isModalOpen,
    closeModal,
    handleAdd,
  } = useQuickAdd(product);

  // Le badge de vente n'a pas de sens sur un produit qu'on ne peut pas prendre.
  const badge = isUnorderable ? null : productBadgeLabel(product);
  // Hors planning récurrent ou hors fenêtre « spécialité de la semaine » : le
  // produit reste visible (comme une pause) mais son prix n'a plus de sens
  // tant qu'il n'est pas dans sa fenêtre — décision volontaire, distincte de
  // `paused`/`soldOut` (prix toujours affiché dans ces deux cas).
  const hidePrice = outOfSchedule || weeklyGated;

  return (
    <>
      <div
        onClick={isUnorderable ? undefined : handleAdd}
        className={`group flex h-full items-stretch gap-3.5 rounded-2xl border border-foreground/5 bg-white/60 p-3 transition-colors duration-200 hover:border-primary/10 hover:bg-white/80 sm:gap-4 ${
          isUnorderable ? '' : 'cursor-pointer'
        }`}
      >
        {/* Visuel — la photo porte la vente : elle est le premier élément lu,
            et c'est elle qui accueille le geste d'ajout (bouton en overlay). */}
        <div className="relative h-28 w-28 shrink-0 overflow-hidden rounded-xl sm:h-32 sm:w-32">
          <ProductMedia
            product={product}
            sizes="(max-width: 640px) 112px, 128px"
            className={
              isUnorderable
                ? 'opacity-50'
                : 'transition-transform duration-500 group-hover:scale-105'
            }
            monogramClassName="text-4xl"
          />

          {/* Ajout rapide, ancré sur la photo (modèle Uber Eats) : cible large
              et lien visuel direct avec ce qu'on ajoute. */}
          {!isUnorderable && (
            <Button
              isIconOnly
              size="sm"
              radius="full"
              color={justAdded ? 'success' : 'default'}
              aria-label={`Ajouter ${product.name}`}
              onPress={handleAdd}
              onClick={(e) => e.stopPropagation()}
              className={`absolute bottom-1.5 right-1.5 min-h-9 min-w-9 cursor-pointer shadow-md transition-transform duration-150 hover:scale-110 active:scale-90 ${
                justAdded ? 'text-white' : 'bg-white text-primary'
              }`}
            >
              {justAdded ? (
                <Check className="h-4 w-4" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
            </Button>
          )}
        </div>

        {/* Info. Le badge ouvre le bloc texte plutôt que de couvrir la photo :
            il se lit dans le fil « badge → nom → prix » sans rien masquer. */}
        <div className="flex min-w-0 flex-1 flex-col">
          {badge && <ProductBadge label={badge} className="mb-1 self-start" />}
          <p className="text-sm font-semibold tracking-tight text-foreground sm:text-base">
            {product.name}
          </p>
          {product.description && (
            <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-foreground/60 sm:text-sm">
              {product.description}
            </p>
          )}
          {!hidePrice && (
            <p className="mt-auto pt-1.5 text-base font-bold text-primary">
              {priceFormatter.format(product.price)}&nbsp;F
            </p>
          )}

          {(paused || soldOut || weeklyGated || outOfSchedule || lowStock) && (
            // `min-w-0` + troncature : un Chip HeroUI est en `min-w-min`, donc
            // un libellé long (« Retour 4 août · 01h52 ») élargissait la carte
            // au-delà de la grille et faisait défiler la page horizontalement.
            <div className="mt-1.5 flex min-w-0 flex-wrap gap-1.5">
              {paused && (
                <Chip
                  color="warning"
                  variant="flat"
                  size="sm"
                  classNames={{ base: 'max-w-full', content: 'truncate' }}
                >
                  Retour {formatResumeLabel(product.unavailableUntil as string)}
                </Chip>
              )}
              {soldOut && (
                <Chip color="danger" variant="flat" size="sm">
                  Épuisé
                </Chip>
              )}
              {/* Priorité pause/épuisé déjà garantie par le hook (`weeklyGated`/
                  `outOfSchedule` ne passent à `true` que si aucun des deux). */}
              {weeklyGated && (
                <Chip
                  color="secondary"
                  variant="flat"
                  size="sm"
                  classNames={{ base: 'max-w-full', content: 'truncate' }}
                >
                  {formatWeeklySpecialLabel(product.weeklySpecialPeriods ?? [])}
                </Chip>
              )}
              {outOfSchedule && (
                <Chip
                  color="secondary"
                  variant="flat"
                  size="sm"
                  classNames={{ base: 'max-w-full', content: 'truncate' }}
                >
                  {formatAvailableDaysLabel(product.availableDays ?? [])}
                </Chip>
              )}
              {/* Rareté : le seul argument d'urgence dont dispose la carte —
                  traité en `warning` pour qu'il se distingue d'une info neutre. */}
              {lowStock && (
                <Chip color="warning" variant="flat" size="sm">
                  Plus que {product.remaining} !
                </Chip>
              )}
            </div>
          )}
        </div>
      </div>

      {hasOptions && (
        <SupplementModal
          product={product}
          isOpen={isModalOpen}
          onClose={closeModal}
        />
      )}
    </>
  );
}

export default ProductCard;
