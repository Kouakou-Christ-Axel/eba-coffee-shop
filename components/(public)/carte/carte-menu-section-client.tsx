// components/(public)/carte/carte-menu-section-client.tsx
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@heroui/react';
import { motion, useReducedMotion } from 'framer-motion';
import type { MenuCategory } from '@/config/menu';
import ProductCard from '@/components/(public)/carte/product-card';
import FeaturedShowcase from '@/components/(public)/carte/featured-showcase';
import CarteMenuToolbar from '@/components/(public)/carte/carte-menu-toolbar';
import ReorderBanner from '@/components/(public)/carte/reorder-banner';
import {
  ProductDeepLink,
  productAnchorId,
} from '@/components/(public)/carte/_components/product-deep-link';
import { filterMenu, parseMenuSearchTerm } from '@/lib/menu-display';
import { isAvailableToday } from '@/lib/supplements';
import { formatAvailableDaysLabel } from '@/components/(public)/carte/_components/availability-labels';
import {
  CARTE_SCROLL_LOCK_MS,
  CARTE_SCROLL_OFFSET_PX,
  CARTE_SCROLL_SPY_BOTTOM_MARGIN,
  CARTE_SCROLL_SPY_GAP_PX,
} from '@/config/constants';

type Props = {
  menuData: MenuCategory[];
};

function CarteMenuSectionClient({ menuData }: Props) {
  const reduceMotion = useReducedMotion();
  const [term, setTerm] = useState('');
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const [activeId, setActiveId] = useState(menuData[0]?.id ?? '');
  const sectionRefs = useRef<Map<string, HTMLElement>>(new Map());
  const navRef = useRef<HTMLDivElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const isScrollingTo = useRef(false);
  const wasFiltered = useRef(false);
  // Hauteur mesurée de la barre collante : elle varie avec la barre de
  // recherche, et elle cale à la fois l'offset de défilement et le rootMargin
  // du scroll-spy. Mesurée après montage (0 au premier rendu, sans effet
  // visible : l'observateur n'existe pas encore).
  const [navHeight, setNavHeight] = useState(0);

  // Pas de debounce ni de `useDeferredValue` : une soixantaine d'objets déjà en
  // mémoire, filtrage O(n) trivial — l'ajout d'un délai ne ferait que rendre la
  // frappe moins réactive.
  const view = useMemo(
    () => filterMenu(menuData, { term, onlyAvailable }),
    [menuData, term, onlyAvailable]
  );
  // La vitrine éditoriale n'a pas sa place au milieu de résultats de recherche.
  // On la garde en revanche sous « Disponible maintenant » seul :
  // `selectShowcaseProducts` filtre déjà sur `isOrderableNow`, le filtre y est
  // un no-op — la masquer serait incohérent.
  const hasSearchTerm = parseMenuSearchTerm(term) !== null;
  const isEmpty = view.categories.length === 0;
  // Le filtre peut emporter la catégorie active avec lui. On dérive la pilule
  // sélectionnée au rendu plutôt que de recaler `activeId` dans un effet : pas
  // de rendu en cascade, et jamais d'état intermédiaire sans sélection.
  const currentId = view.categories.some((c) => c.id === activeId)
    ? activeId
    : (view.categories[0]?.id ?? '');

  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;

    const measure = () => setNavHeight(nav.offsetHeight);
    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(nav);
    return () => observer.disconnect();
  }, []);

  // Les observateurs suivent le jeu de sections AFFICHÉES : filtrer démonte des
  // sections et en remonte d'autres, un effet monté une seule fois observerait
  // des nœuds détachés.
  useEffect(() => {
    if (navHeight === 0) return;

    const observers: IntersectionObserver[] = [];

    sectionRefs.current.forEach((el, id) => {
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting && !isScrollingTo.current) {
            setActiveId(id);
          }
        },
        {
          rootMargin: `-${navHeight + CARTE_SCROLL_SPY_GAP_PX}px 0px -${CARTE_SCROLL_SPY_BOTTOM_MARGIN} 0px`,
          threshold: 0,
        }
      );
      observer.observe(el);
      observers.push(observer);
    });

    return () => observers.forEach((o) => o.disconnect());
  }, [view.categories, navHeight]);

  // À la PREMIÈRE activation d'un filtre seulement : sans ça, le client qui
  // filtre depuis le bas de la page se retrouve sous les résultats, devant du
  // vide. Sur les frappes suivantes il est déjà en haut — le reposionner à
  // chaque lettre serait hostile.
  useEffect(() => {
    if (view.isFiltered === wasFiltered.current) return;
    wasFiltered.current = view.isFiltered;
    if (!view.isFiltered) return;

    const el = resultsRef.current;
    if (!el) return;
    const top =
      el.getBoundingClientRect().top + window.scrollY - navHeight - 16;
    window.scrollTo({ top, behavior: reduceMotion ? 'auto' : 'smooth' });
  }, [view.isFiltered, navHeight, reduceMotion]);

  function scrollToCategory(id: string) {
    const el = sectionRefs.current.get(id);
    if (!el) return;

    isScrollingTo.current = true;
    setActiveId(id);

    const top =
      el.getBoundingClientRect().top +
      window.scrollY -
      navHeight -
      CARTE_SCROLL_OFFSET_PX;
    window.scrollTo({ top, behavior: 'smooth' });

    setTimeout(() => {
      isScrollingTo.current = false;
    }, CARTE_SCROLL_LOCK_MS);
  }

  function resetFilters() {
    setTerm('');
    setOnlyAvailable(false);
  }

  useEffect(() => {
    if (!navRef.current) return;
    const activeBtn = navRef.current.querySelector('[data-active="true"]');
    if (activeBtn) {
      activeBtn.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center',
      });
    }
  }, [currentId]);

  return (
    <section
      aria-label="Menu EBA Coffee Shop"
      className="bg-[linear-gradient(180deg,rgba(255,252,248,1)_0%,rgba(247,239,232,1)_100%)] pb-14 md:pb-20"
    >
      <div
        ref={navRef}
        className="sticky top-16 z-30 border-b border-foreground/5 bg-background/90 backdrop-blur-sm"
      >
        <div className="content-container">
          <CarteMenuToolbar
            term={term}
            onTermChange={setTerm}
            onlyAvailable={onlyAvailable}
            onOnlyAvailableChange={setOnlyAvailable}
            resultCount={view.resultCount}
            totalCount={view.totalCount}
            isFiltered={view.isFiltered}
            inputRef={searchInputRef}
          />

          <nav
            className="flex gap-1 overflow-x-auto py-3 scrollbar-none"
            aria-label="Catégories du menu"
          >
            {view.categories.map((cat) => {
              // Même donnée que l'en-tête de section : une catégorie fermée
              // aujourd'hui se signale dès la nav plutôt qu'au scroll.
              const closedToday = !isAvailableToday(cat.availableDays);
              const daysLabel = closedToday
                ? formatAvailableDaysLabel(cat.availableDays ?? [])
                : null;
              const isActive = currentId === cat.id;
              return (
                <button
                  key={cat.id}
                  data-active={isActive}
                  aria-current={isActive ? 'true' : undefined}
                  aria-label={
                    daysLabel ? `${cat.name} — ${daysLabel}` : undefined
                  }
                  title={daysLabel ?? undefined}
                  onClick={() => scrollToCategory(cat.id)}
                  className={`flex shrink-0 items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition-colors duration-200 ${
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'text-foreground/60 hover:bg-foreground/5 hover:text-foreground'
                  } ${closedToday && !isActive ? 'opacity-50' : ''}`}
                >
                  {cat.name}
                  {/* Compte les produits AFFICHÉS. Volontairement pas « les
                      commandables » : ce serait une valeur dépendante de
                      l'heure calculée au rendu client, donc divergente du HTML
                      servi par l'ISR. */}
                  <span
                    className={
                      isActive ? 'text-primary-foreground/70' : 'opacity-60'
                    }
                  >
                    {cat.products.length}
                  </span>
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Cible le menu COMPLET : un lien partagé doit ouvrir son produit même
          si le visiteur a déjà un filtre actif. */}
      <ProductDeepLink menuData={menuData} />

      {/* Vitrines nourries du menu COMPLET : ce ne sont pas des résultats de
          recherche, elles ne doivent pas rétrécir avec le filtre. La vitrine
          personnelle passe avant la générique. */}
      {!hasSearchTerm && (
        <>
          <ReorderBanner menuData={menuData} />
          <FeaturedShowcase menuData={menuData} />
        </>
      )}

      <div
        ref={resultsRef}
        className="content-container mt-8 space-y-10 md:mt-10 md:space-y-14"
      >
        {isEmpty && (
          <div className="py-10 text-center">
            <p className="text-base font-semibold text-foreground">
              {hasSearchTerm
                ? `Aucun produit ne correspond à « ${term.trim()} ».`
                : 'Aucun produit disponible pour le moment.'}
            </p>
            <p className="mt-1 text-sm text-foreground/60">
              Essayez un autre mot, ou parcourez la carte complète.
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              {hasSearchTerm && (
                <Button
                  radius="full"
                  variant="bordered"
                  className="cursor-pointer"
                  onPress={() => {
                    setTerm('');
                    searchInputRef.current?.focus();
                  }}
                >
                  Effacer la recherche
                </Button>
              )}
              <Button
                radius="full"
                color="primary"
                className="cursor-pointer"
                onPress={resetFilters}
              >
                Voir toute la carte
              </Button>
            </div>
          </div>
        )}

        {view.categories.map((category) => {
          // Planning propre à la catégorie (indépendant de celui de ses
          // produits, déjà intégré individuellement par intersection) : sert
          // uniquement au message d'en-tête de section, pas au blocage des
          // produits eux-mêmes.
          const categoryOutOfSchedule = !isAvailableToday(
            category.availableDays
          );
          return (
            <div
              key={category.id}
              id={category.id}
              ref={(el) => {
                if (!el) return;
                sectionRefs.current.set(category.id, el);
                // Nettoyage indispensable depuis que le jeu de sections est
                // filtrable : une entrée survivante pointerait vers un nœud
                // détaché, et `scrollToCategory` défilerait dans le vide.
                return () => {
                  sectionRefs.current.delete(category.id);
                };
              }}
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
                  // `initial`/`whileInView` sont volontairement IDENTIQUES en
                  // reduced-motion : `useReducedMotion()` vaut `false` côté
                  // serveur, donc conditionner ces props dessus produisait un
                  // markup différent du client. React abandonnait l'hydratation
                  // et les cartes restaient bloquées à `opacity: 0` — carte
                  // entièrement blanche pour qui a coupé les animations. Seule
                  // la DURÉE varie : le rendu est instantané au lieu d'animé.
                  //
                  // Elle est également coupée sous filtre : les cartes
                  // démontent et remontent à chaque frappe (`once: true` ne
                  // protège pas d'un remontage), et rejouer la cascade
                  // échelonnée donnerait des résultats qui clignotent.
                  <motion.div
                    key={product.id}
                    id={productAnchorId(product.id)}
                    // Cible d'un lien `/carte?p=<id>` : focusable au clavier
                    // pour que la fermeture de la modale rende le focus ici
                    // plutôt qu'en haut du document.
                    tabIndex={-1}
                    className="scroll-mt-40 outline-none focus-visible:rounded-2xl focus-visible:ring-2 focus-visible:ring-secondary"
                    initial={{ opacity: 0, y: 16 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.15 }}
                    transition={
                      reduceMotion || view.isFiltered
                        ? { duration: 0 }
                        : { duration: 0.4, delay: i * 0.05, ease: 'easeOut' }
                    }
                  >
                    <ProductCard product={product} />
                  </motion.div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default CarteMenuSectionClient;
