'use client';

import Image from 'next/image';
import React from 'react';
import { Button, Link } from '@heroui/react';
import { motion, useReducedMotion } from 'framer-motion';

type PlaceImage = {
  src: string;
  alt: string;
  objectPositionClassName: string;
};

const placeImages: PlaceImage[] = [
  {
    src: '/assets/examples/accueil/eba-hero-2.png',
    alt: 'Comptoir cafe soigne avec service de patisserie dans une ambiance chaleureuse a Abidjan',
    objectPositionClassName: 'object-center',
  },
  {
    src: '/assets/examples/accueil/eba-hero.webp',
    alt: 'Coin assise intime pour savourer un cafe et une patisserie dans le coffee shop EBA',
    objectPositionClassName: 'object-left',
  },
  {
    src: '/assets/examples/accueil/eba-hero-2.png',
    alt: 'Detail deco premium du lieu EBA entre matieres chaudes et ambiance elegante',
    objectPositionClassName: 'object-right',
  },
  {
    src: '/assets/examples/accueil/eba-hero.webp',
    alt: 'Boisson et patisserie servies sur table dans un espace soigne a Abidjan',
    objectPositionClassName: 'object-center',
  },
];

function PlaceSection() {
  const reduceMotion = useReducedMotion();

  const introAnimation = reduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: 22 },
        whileInView: { opacity: 1, y: 0 },
        viewport: { once: true, amount: 0.5 },
        transition: { duration: 0.7, ease: 'easeOut' as const },
      };

  return (
    <section
      className="bg-[linear-gradient(180deg,rgba(255,251,247,1)_0%,rgba(250,245,241,1)_100%)] py-14 md:py-20"
      aria-labelledby="place-section-title"
    >
      <div className="content-container px-6">
        <div className="mx-auto max-w-3xl text-left">
          <motion.h2
            id="place-section-title"
            className="text-3xl font-bold tracking-tight sm:text-4xl"
            {...introAnimation}
          >
            Le lieu
          </motion.h2>

          <motion.p
            className="mt-4 max-w-2xl text-sm leading-relaxed text-foreground/80 sm:text-base"
            {...introAnimation}
            transition={
              reduceMotion
                ? undefined
                : { duration: 0.7, ease: 'easeOut', delay: 0.1 }
            }
          >
            Un espace pens&eacute; pour savourer un caf&eacute; et une
            p&acirc;tisserie dans une ambiance intime, soign&eacute;e et
            chaleureuse &agrave; Abidjan.
          </motion.p>

          <motion.div
            className="mt-6"
            {...introAnimation}
            transition={
              reduceMotion
                ? undefined
                : { duration: 0.7, ease: 'easeOut', delay: 0.2 }
            }
          >
            <Button
              as={Link}
              href="/le-lieu"
              color="primary"
              variant="bordered"
              radius="full"
              className="px-7"
            >
              Voir le lieu
            </Button>
          </motion.div>
        </div>

        <ul
          className="mt-8 flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 md:mt-10 md:grid md:grid-cols-4 md:gap-5 md:overflow-visible md:pb-0"
          role="list"
        >
          {placeImages.map((image, index) => (
            <motion.li
              key={image.alt}
              className={`${index === 3 ? 'hidden md:block' : ''} w-[82%] shrink-0 snap-start sm:w-[62%] md:w-auto`}
              initial={reduceMotion ? undefined : { opacity: 0, y: 18 }}
              whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.35 }}
              transition={
                reduceMotion
                  ? undefined
                  : { duration: 0.75, ease: 'easeOut', delay: index * 0.08 }
              }
            >
              <figure className="group overflow-hidden rounded-2xl border border-default-200/75 bg-content1 shadow-sm transition duration-500 md:hover:shadow-xl">
                <div className="relative h-64 w-full overflow-hidden sm:h-72 md:h-80">
                  <Image
                    src={image.src}
                    alt={image.alt}
                    fill
                    sizes="(max-width: 768px) 82vw, (max-width: 1024px) 62vw, 25vw"
                    className={`object-cover ${image.objectPositionClassName} transition-transform duration-500 ease-out md:group-hover:scale-[1.03]`}
                  />
                </div>
              </figure>
            </motion.li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export default PlaceSection;
