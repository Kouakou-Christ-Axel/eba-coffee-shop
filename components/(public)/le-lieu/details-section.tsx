'use client';

import Image from 'next/image';
import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';

type DetailItem = {
  id: string;
  title: string;
  text: string;
  imageSrc: string;
  imageAlt: string;
  objectPositionClassName: string;
};

const detailItems: DetailItem[] = [
  {
    id: 'cozy-corner',
    title: 'Coin cosy',
    text: 'Pour discuter et ralentir.',
    imageSrc: '/assets/examples/accueil/eba-hero-2.png',
    imageAlt: 'Coin cosy du lieu EBA pour une pause cafe a Abidjan',
    objectPositionClassName: 'object-left',
  },
  {
    id: 'soft-light',
    title: 'Lumiere douce',
    text: 'Une ambiance calme et chaude.',
    imageSrc: '/assets/examples/accueil/eba-hero.webp',
    imageAlt: 'Lumiere douce dans la salle du coffee shop EBA',
    objectPositionClassName: 'object-center',
  },
  {
    id: 'attentive-service',
    title: 'Service attentionne',
    text: 'Des gestes precis, sans stress.',
    imageSrc: '/assets/examples/accueil/eba-hero.webp',
    imageAlt: 'Service soigne de cafe et patisserie chez EBA',
    objectPositionClassName: 'object-right',
  },
  {
    id: 'beautiful-presentation',
    title: 'Belle presentation',
    text: 'Chaque gourmandise est soignee.',
    imageSrc: '/assets/examples/accueil/eba-hero-2.png',
    imageAlt: 'Presentation elegante des gourmandises dans le lieu EBA',
    objectPositionClassName: 'object-center',
  },
];

function DetailsSection() {
  const prefersReducedMotion = useReducedMotion();

  const introAnimation = prefersReducedMotion
    ? {}
    : {
        initial: { opacity: 0, y: 20 },
        whileInView: { opacity: 1, y: 0 },
        viewport: { once: true, amount: 0.35 },
        transition: { duration: 0.6, ease: 'easeOut' as const },
      };

  return (
    <section
      aria-labelledby="details-title"
      className="bg-[linear-gradient(180deg,rgba(255,252,249,1)_0%,rgba(250,245,239,1)_100%)] py-12 md:py-16"
    >
      <div className="content-container">
        <div className="mb-8 flex flex-col gap-3 md:mb-10 md:items-center md:text-center">
          <motion.div {...introAnimation}>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
              Signature du lieu
            </p>
            <h2
              id="details-title"
              className="mt-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl"
            >
              Les petits details qui font la difference
            </h2>
          </motion.div>

          <motion.p
            className="max-w-2xl text-sm leading-relaxed text-foreground/75"
            {...introAnimation}
            transition={
              prefersReducedMotion
                ? undefined
                : { duration: 0.6, ease: 'easeOut', delay: 0.08 }
            }
          >
            Une ambiance qui se ressent des les premiers instants.
          </motion.p>
        </div>

        <ul
          role="list"
          className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 sm:grid sm:grid-cols-2 sm:overflow-visible sm:pb-0 lg:grid-cols-4"
        >
          {detailItems.map((item, index) => (
            <motion.li
              key={item.id}
              className="w-[84%] shrink-0 snap-start sm:w-auto sm:shrink"
              initial={prefersReducedMotion ? undefined : { opacity: 0, y: 16 }}
              whileInView={
                prefersReducedMotion ? undefined : { opacity: 1, y: 0 }
              }
              viewport={{ once: true, amount: 0.3 }}
              transition={
                prefersReducedMotion
                  ? undefined
                  : { duration: 0.45, ease: 'easeOut', delay: index * 0.07 }
              }
            >
              <figure className="group relative h-72 overflow-hidden rounded-3xl border border-border/70 bg-card shadow-sm transition duration-300 md:h-80 md:hover:-translate-y-0.5 md:hover:shadow-xl">
                <Image
                  src={item.imageSrc}
                  alt={item.imageAlt}
                  fill
                  sizes="(max-width: 640px) 84vw, (max-width: 1024px) 48vw, 24vw"
                  className={`object-cover ${item.objectPositionClassName} transition-transform duration-500 ease-out md:group-hover:scale-[1.04]`}
                />

                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 bg-linear-to-t from-black/72 via-black/28 to-black/8"
                />

                <figcaption className="absolute inset-x-0 bottom-0 p-4 md:p-5">
                  <span className="inline-flex rounded-full border border-white/30 bg-black/25 px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.14em] text-white/90 backdrop-blur-xs">
                    0{index + 1}
                  </span>
                  <h3 className="mt-3 text-base font-semibold text-white md:text-lg">
                    {item.title}
                  </h3>
                  <p className="mt-1 text-sm leading-relaxed text-white/85">
                    {item.text}
                  </p>
                </figcaption>
              </figure>
            </motion.li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export default DetailsSection;
