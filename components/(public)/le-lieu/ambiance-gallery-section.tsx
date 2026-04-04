'use client';

import Image from 'next/image';
import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';

type GalleryItem = {
  src: string;
  alt: string;
  desktopClassName: string;
  objectPositionClassName: string;
};

const galleryItems: GalleryItem[] = [
  {
    src: '/assets/examples/accueil/eba-hero-2.png',
    alt: 'Salle principale du coffee shop EBA a Abidjan',
    desktopClassName: 'md:col-span-7 md:h-[27rem]',
    objectPositionClassName: 'object-center',
  },
  {
    src: '/assets/examples/accueil/eba-hero.webp',
    alt: 'Coin cosy pour savourer cafe et patisserie',
    desktopClassName: 'md:col-span-5 md:h-[20rem]',
    objectPositionClassName: 'object-left',
  },
  {
    src: '/assets/examples/accueil/eba-hero.webp',
    alt: 'Comptoir et details deco dans une lumiere chaude',
    desktopClassName: 'md:col-span-4 md:h-[19rem]',
    objectPositionClassName: 'object-right',
  },
  {
    src: '/assets/examples/accueil/eba-hero-2.png',
    alt: 'Cafe servi a table dans une ambiance conviviale',
    desktopClassName: 'md:col-span-8 md:h-[19rem]',
    objectPositionClassName: 'object-center',
  },
];

function AmbianceGallerySection() {
  const reduceMotion = useReducedMotion();

  const introAnimation = reduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: 20 },
        whileInView: { opacity: 1, y: 0 },
        viewport: { once: true, amount: 0.45 },
        transition: { duration: 0.7, ease: 'easeOut' as const },
      };

  return (
    <section
      aria-labelledby="ambiance-title"
      className="bg-[linear-gradient(180deg,rgba(255,252,248,1)_0%,rgba(249,244,239,1)_100%)] py-12 md:py-16"
    >
      <div className="content-container">
        <div className="mb-8 flex flex-col gap-3 md:mb-10">
          <motion.p
            className="text-xs font-semibold uppercase tracking-[0.18em] text-primary"
            {...introAnimation}
          >
            Le lieu EBA
          </motion.p>

          <motion.h2
            id="ambiance-title"
            className="text-3xl font-bold tracking-tight sm:text-4xl"
            {...introAnimation}
            transition={
              reduceMotion
                ? undefined
                : { duration: 0.7, ease: 'easeOut', delay: 0.08 }
            }
          >
            Une ambiance qui donne envie de s&apos;attarder
          </motion.h2>
        </div>

        <ul
          role="list"
          className="mt-6 flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 md:grid md:grid-cols-12 md:gap-5 md:overflow-visible md:pb-0"
        >
          {galleryItems.map((item, index) => (
            <motion.li
              key={item.alt}
              className={`${item.desktopClassName} w-[84%] shrink-0 snap-start sm:w-[68%] md:w-auto md:shrink md:snap-none`}
              initial={reduceMotion ? undefined : { opacity: 0, y: 18 }}
              whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={
                reduceMotion
                  ? undefined
                  : { duration: 0.6, ease: 'easeOut', delay: index * 0.08 }
              }
            >
              <figure className="group relative h-72 overflow-hidden rounded-3xl border border-border/70 bg-card shadow-sm transition duration-300 md:h-full md:hover:shadow-xl">
                <Image
                  src={item.src}
                  alt={item.alt}
                  width={1600}
                  height={1200}
                  sizes="(max-width: 640px) 84vw, (max-width: 768px) 68vw, 50vw"
                  className={`h-full w-full object-cover ${item.objectPositionClassName} transition-transform duration-500 ease-out md:group-hover:scale-[1.03]`}
                />

                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-linear-to-t from-black/30 to-transparent"
                />
              </figure>
            </motion.li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export default AmbianceGallerySection;
