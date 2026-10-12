import { m } from 'framer-motion';
import type { MenuCategory } from '@/config/menu';
import ProductCard from '@/components/(public)/carte/product-card';
import { productAnchorId } from '@/components/(public)/carte/_components/product-deep-link';
import { isAvailableToday } from '@/lib/supplements';
import { formatAvailableDaysLabel } from '@/components/(public)/carte/_components/availability-labels';

export function CategorySection({
  category,
  registerSection,
  instant,
}: {
  category: MenuCategory;
  registerSection: (id: string, el: HTMLElement | null) => void | (() => void);
  /** Pas de cascade : reduced-motion ou résultats filtrés. */
  instant: boolean;
}) {
  // N'affecte que l'en-tête de section, pas le blocage des produits.
  const categoryOutOfSchedule = !isAvailableToday(category.availableDays);

  return (
    <div
      id={category.id}
      ref={(el) => registerSection(category.id, el)}
      className={categoryOutOfSchedule ? 'opacity-60' : undefined}
    >
      <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
        {category.name}
      </h2>
      {categoryOutOfSchedule && (
        <p className="mt-0.5 text-sm text-foreground/60">
          {formatAvailableDaysLabel(category.availableDays ?? [])}
        </p>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {category.products.map((product, i) => (
          // `initial`/`whileInView` identiques en reduced-motion : les
          // conditionner sur `useReducedMotion()` (false côté serveur)
          // casserait l'hydratation et laisserait les cartes à opacity 0.
          // Seule la durée varie, aussi coupée sous filtre (remontage à
          // chaque frappe).
          <m.div
            key={product.id}
            id={productAnchorId(product.id)}
            // Cible d'un lien `/carte?p=<id>` : focusable pour le retour du focus.
            tabIndex={-1}
            className="scroll-mt-40 outline-none focus-visible:rounded-2xl focus-visible:ring-2 focus-visible:ring-secondary"
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.15 }}
            transition={
              instant
                ? { duration: 0 }
                : { duration: 0.4, delay: i * 0.05, ease: 'easeOut' }
            }
          >
            <ProductCard product={product} />
          </m.div>
        ))}
      </div>
    </div>
  );
}
