// components/(public)/carte/carte-menu-section-client.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import type { MenuCategory } from '@/config/menu';
import ProductCard from '@/components/(public)/carte/product-card';

type Props = {
  menuData: MenuCategory[];
};

function CarteMenuSectionClient({ menuData }: Props) {
  const reduceMotion = useReducedMotion();
  const [activeId, setActiveId] = useState(menuData[0]?.id ?? '');
  const sectionRefs = useRef<Map<string, HTMLElement>>(new Map());
  const navRef = useRef<HTMLDivElement>(null);
  const isScrollingTo = useRef(false);

  useEffect(() => {
    const observers: IntersectionObserver[] = [];

    sectionRefs.current.forEach((el, id) => {
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting && !isScrollingTo.current) {
            setActiveId(id);
          }
        },
        { rootMargin: '-120px 0px -60% 0px', threshold: 0 }
      );
      observer.observe(el);
      observers.push(observer);
    });

    return () => observers.forEach((o) => o.disconnect());
  }, []);

  function scrollToCategory(id: string) {
    const el = sectionRefs.current.get(id);
    if (!el) return;

    isScrollingTo.current = true;
    setActiveId(id);

    const navHeight = navRef.current?.offsetHeight ?? 0;
    const top =
      el.getBoundingClientRect().top + window.scrollY - navHeight - 80;
    window.scrollTo({ top, behavior: 'smooth' });

    setTimeout(() => {
      isScrollingTo.current = false;
    }, 800);
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
  }, [activeId]);

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
          <nav
            className="flex gap-1 overflow-x-auto py-3 scrollbar-none"
            aria-label="Catégories du menu"
          >
            {menuData.map((cat) => (
              <button
                key={cat.id}
                data-active={activeId === cat.id}
                onClick={() => scrollToCategory(cat.id)}
                className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors duration-200 ${
                  activeId === cat.id
                    ? 'bg-primary text-primary-foreground'
                    : 'text-foreground/60 hover:bg-foreground/5 hover:text-foreground'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </nav>
        </div>
      </div>

      <div className="content-container mt-6 space-y-10 md:mt-8 md:space-y-14">
        {menuData.map((category) => (
          <div
            key={category.id}
            id={category.id}
            ref={(el) => {
              if (el) sectionRefs.current.set(category.id, el);
            }}
          >
            <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
              {category.name}
            </h2>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {category.products.map((product, i) => (
                <motion.div
                  key={product.id}
                  initial={reduceMotion ? undefined : { opacity: 0, y: 16 }}
                  whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.15 }}
                  transition={
                    reduceMotion
                      ? undefined
                      : { duration: 0.4, delay: i * 0.05, ease: 'easeOut' }
                  }
                >
                  <ProductCard product={product} />
                </motion.div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default CarteMenuSectionClient;
