// components/(public)/carte/featured-showcase.tsx
'use client';

// Vitrine en tête de carte : la réponse à « qu'est-ce que je prends ? ».
// Sans elle, le client arrive sur une liste plate où tous les produits pèsent
// pareil et doit choisir sans aide. Ici on met en avant quelques produits, en
// grand, avec la photo comme argument principal.
//
// Priorité de sélection : d'abord les produits classés aux ventes (fait
// mesuré), puis les mises en avant éditoriales du dashboard (`featured`) pour
// compléter — la vitrine reste ainsi pleine même sans historique de ventes.

import dynamic from 'next/dynamic';
import { motion, useReducedMotion } from 'framer-motion';
import { Button } from '@heroui/react';
import { Check, Plus } from 'lucide-react';
import { priceFormatter, type MenuCategory, type Product } from '@/config/menu';
import {
  isPausedNow,
  isAvailableToday,
  isWithinAnyPeriod,
} from '@/lib/supplements';
import {
  SHOWCASE_MAX_PRODUCTS,
  SHOWCASE_MIN_PRODUCTS,
} from '@/config/constants';
import { useQuickAdd } from './_components/use-quick-add';
import {
  ProductBadge,
  ProductMedia,
  productBadgeLabel,
} from './_components/product-media';

const SupplementModal = dynamic(
  () => import('@/components/(public)/carte/supplement-modal'),
  { ssr: false }
);

/**
 * Produits éligibles à la vitrine : commandables uniquement (mettre en avant
 * un produit épuisé est le meilleur moyen de décevoir), classés d'abord par
 * rang de vente, puis par ordre de mise en avant éditoriale.
 */
export function selectShowcaseProducts(menuData: MenuCategory[]): Product[] {
  const orderable = menuData
    .flatMap((category) => category.products)
    .filter(
      (p) =>
        p.soldOut !== true &&
        !isPausedNow(p.unavailableUntil) &&
        isAvailableToday(p.availableDays) &&
        isWithinAnyPeriod(p.weeklySpecialPeriods)
    );

  const ranked = orderable
    .filter((p) => p.popularRank != null)
    .sort((a, b) => (a.popularRank ?? 0) - (b.popularRank ?? 0));

  const editorial = orderable
    .filter((p) => p.popularRank == null && p.featured)
    .sort((a, b) => (a.featuredOrder ?? 0) - (b.featuredOrder ?? 0));

  return [...ranked, ...editorial].slice(0, SHOWCASE_MAX_PRODUCTS);
}

function ShowcaseCard({ product }: { product: Product }) {
  const { hasOptions, justAdded, isModalOpen, closeModal, handleAdd } =
    useQuickAdd(product);
  const badge = productBadgeLabel(product);

  return (
    <>
      <div
        onClick={handleAdd}
        className="group w-44 shrink-0 cursor-pointer snap-start overflow-hidden rounded-2xl border border-foreground/5 bg-white/70 transition-colors duration-200 hover:border-primary/15 hover:bg-white"
      >
        <div className="relative h-40 w-full overflow-hidden">
          <ProductMedia
            product={product}
            sizes="176px"
            className="transition-transform duration-500 group-hover:scale-105"
            monogramClassName="text-5xl"
          />

          <Button
            isIconOnly
            size="sm"
            radius="full"
            color={justAdded ? 'success' : 'default'}
            aria-label={`Ajouter ${product.name}`}
            onPress={handleAdd}
            onClick={(e) => e.stopPropagation()}
            className={`absolute bottom-2 right-2 min-h-9 min-w-9 cursor-pointer shadow-md transition-transform duration-150 hover:scale-110 active:scale-90 ${
              justAdded ? 'text-white' : 'bg-white text-primary'
            }`}
          >
            {justAdded ? (
              <Check className="h-4 w-4" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* Le badge ouvre le bloc texte, sous la photo : en overlay il masquait
            une partie du visuel qu'on venait justement d'agrandir. */}
        <div className="px-3 py-2.5">
          {badge && <ProductBadge label={badge} className="mb-1" />}
          <p className="truncate text-sm font-semibold tracking-tight text-foreground">
            {product.name}
          </p>
          <p className="mt-1 text-sm font-bold text-primary">
            {priceFormatter.format(product.price)}&nbsp;F
          </p>
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

function FeaturedShowcase({ menuData }: { menuData: MenuCategory[] }) {
  const reduceMotion = useReducedMotion();
  const products = selectShowcaseProducts(menuData);

  // En dessous de ce seuil, une « vitrine » de deux produits ressemble à un
  // bug d'affichage plutôt qu'à une sélection : on n'affiche rien.
  if (products.length < SHOWCASE_MIN_PRODUCTS) return null;

  return (
    <motion.section
      aria-labelledby="vitrine-title"
      className="content-container mt-6 md:mt-8"
      // Props d'animation identiques serveur/client : voir la note dans
      // carte-menu-section-client.tsx — conditionner `initial` sur
      // `useReducedMotion()` casse l'hydratation. Seule la durée varie.
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={
        reduceMotion ? { duration: 0 } : { duration: 0.4, ease: 'easeOut' }
      }
    >
      <h2
        id="vitrine-title"
        className="text-xl font-semibold tracking-tight sm:text-2xl"
      >
        Les plus commandés
      </h2>
      <p className="mt-1 text-sm text-foreground/60">
        Les valeurs sûres de la maison, prêtes en un geste.
      </p>

      {/* Marges négatives calées sur le `px-4` de `content-container` : la
          bande déborde jusqu'aux bords de l'écran pour que la dernière carte
          soit coupée — l'indice le plus lisible qu'il y a autre chose à
          droite. Un décalage plus large ferait défiler la PAGE. */}
      <div className="-mx-4 mt-4 overflow-x-auto px-4 pb-2 scrollbar-none">
        <div className="flex snap-x snap-mandatory gap-3">
          {products.map((product) => (
            <ShowcaseCard key={product.id} product={product} />
          ))}
        </div>
      </div>
    </motion.section>
  );
}

export default FeaturedShowcase;
