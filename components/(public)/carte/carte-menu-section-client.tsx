// components/(public)/carte/carte-menu-section-client.tsx
'use client';

import type { MenuCategory } from '@/config/menu';
import FeaturedShowcase from '@/components/(public)/carte/featured-showcase';
import CarteMenuToolbar from '@/components/(public)/carte/carte-menu-toolbar';
import ReorderBanner from '@/components/(public)/carte/reorder-banner';
import { ProductDeepLink } from '@/components/(public)/carte/_components/product-deep-link';
import { CategoryNav } from '@/components/(public)/carte/_components/menu-section/category-nav';
import { CategorySection } from '@/components/(public)/carte/_components/menu-section/category-section';
import { EmptyResults } from '@/components/(public)/carte/_components/menu-section/empty-results';
import { useCarteMenuSection } from '@/components/(public)/carte/_components/menu-section/use-carte-menu-section';

type Props = {
  menuData: MenuCategory[];
};

function CarteMenuSectionClient({ menuData: initialMenu }: Props) {
  const { navRef, resultsRef, searchInputRef, ...menu } =
    useCarteMenuSection(initialMenu);
  const { menuData, view } = menu;

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
            term={menu.term}
            onTermChange={menu.setTerm}
            onlyAvailable={menu.onlyAvailable}
            onOnlyAvailableChange={menu.setOnlyAvailable}
            resultCount={view.resultCount}
            totalCount={view.totalCount}
            isFiltered={view.isFiltered}
            inputRef={searchInputRef}
          />

          <CategoryNav
            categories={view.categories}
            currentId={menu.currentId}
            onSelect={menu.scrollToCategory}
          />
        </div>
      </div>

      {/* Menu COMPLET : un lien partagé ouvre son produit même sous filtre. */}
      <ProductDeepLink menuData={menuData} />

      {/* Vitrines nourries du menu COMPLET, la personnelle avant la générique. */}
      {!menu.hasSearchTerm && (
        <>
          <ReorderBanner menuData={menuData} />
          <FeaturedShowcase menuData={menuData} />
        </>
      )}

      <div
        ref={resultsRef}
        className="content-container mt-8 space-y-10 md:mt-10 md:space-y-14"
      >
        {menu.isEmpty && (
          <EmptyResults
            hasSearchTerm={menu.hasSearchTerm}
            term={menu.term}
            onClearSearch={menu.clearSearch}
            onResetFilters={menu.resetFilters}
          />
        )}

        {view.categories.map((category) => (
          <CategorySection
            key={category.id}
            category={category}
            registerSection={menu.registerSection}
            instant={menu.reduceMotion || view.isFiltered}
          />
        ))}
      </div>
    </section>
  );
}

export default CarteMenuSectionClient;
