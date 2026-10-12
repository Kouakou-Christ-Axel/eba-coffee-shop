import { useEffect, useMemo, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import type { MenuCategory } from '@/config/menu';
import { usePublicMenu } from '@/lib/hooks/use-public-menu';
import { filterMenu, parseMenuSearchTerm } from '@/lib/menu-display';
import {
  CARTE_SCROLL_LOCK_MS,
  CARTE_SCROLL_OFFSET_PX,
  CARTE_SCROLL_SPY_BOTTOM_MARGIN,
  CARTE_SCROLL_SPY_GAP_PX,
} from '@/config/constants';

export function useCarteMenuSection(initialMenu: MenuCategory[]) {
  // Rendu ISR au départ, puis relu en continu.
  const menuData = usePublicMenu(initialMenu);
  const reduceMotion = useReducedMotion();
  const [term, setTerm] = useState('');
  // Faux au rendu serveur : la carte reste complète dans le HTML prérendu
  // (JSON-LD compris). Basculé à vrai après montage.
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const [activeId, setActiveId] = useState(menuData[0]?.id ?? '');
  const sectionRefs = useRef<Map<string, HTMLElement>>(new Map());
  const navRef = useRef<HTMLDivElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const isScrollingTo = useRef(false);
  const wasFiltered = useRef(false);
  // Hauteur de la barre collante : cale l'offset de défilement et le scroll-spy.
  const [navHeight, setNavHeight] = useState(0);

  const view = useMemo(
    () => filterMenu(menuData, { term, onlyAvailable }),
    [menuData, term, onlyAvailable]
  );
  // La vitrine éditoriale n'a pas sa place au milieu de résultats de recherche.
  const hasSearchTerm = parseMenuSearchTerm(term) !== null;
  const isEmpty = view.categories.length === 0;
  // Dérivé au rendu : le filtre peut emporter la catégorie active.
  const currentId = view.categories.some((c) => c.id === activeId)
    ? activeId
    : (view.categories[0]?.id ?? '');

  useEffect(() => {
    // Ce premier passage à `true` est automatique : pas de repositionnement.
    wasFiltered.current = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- bascule unique post-hydratation
    setOnlyAvailable(true);
  }, []);

  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;

    const measure = () => setNavHeight(nav.offsetHeight);
    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(nav);
    return () => observer.disconnect();
  }, []);

  // Suit les sections AFFICHÉES : filtrer démonte/remonte des nœuds.
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

  // Première activation d'un filtre seulement : pas de saut à chaque frappe.
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

  function registerSection(id: string, el: HTMLElement | null) {
    if (!el) return;
    sectionRefs.current.set(id, el);
    // Une entrée survivante pointerait vers un nœud détaché.
    return () => {
      sectionRefs.current.delete(id);
    };
  }

  function clearSearch() {
    setTerm('');
    searchInputRef.current?.focus();
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

  return {
    menuData,
    reduceMotion,
    term,
    setTerm,
    onlyAvailable,
    setOnlyAvailable,
    navRef,
    resultsRef,
    searchInputRef,
    registerSection,
    clearSearch,
    view,
    hasSearchTerm,
    isEmpty,
    currentId,
    scrollToCategory,
    resetFilters,
  };
}

export type CarteMenuSectionState = ReturnType<typeof useCarteMenuSection>;
