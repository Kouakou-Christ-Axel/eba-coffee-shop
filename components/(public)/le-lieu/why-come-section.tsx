'use client';

import Image from 'next/image';
import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Button, Link } from '@heroui/react';

type ReasonItem = {
  title: string;
  text: string;
};

const reasons: ReasonItem[] = [
  {
    title: 'Pour un cafe tranquille',
    text: 'Un rythme plus doux, loin du bruit.',
  },
  {
    title: 'Pour une pause gourmande',
    text: 'Cafe et patisserie servis avec soin.',
  },
  {
    title: 'Pour un moment a deux',
    text: 'Un cadre intime pour se retrouver.',
  },
  {
    title: 'Pour travailler ou respirer',
    text: 'Un espace confortable pour se poser.',
  },
  {
    title: 'Pour decouvrir EBA',
    text: 'Un lieu doux et accueillant a Abidjan.',
  },
];

function WhyComeSection() {
  const prefersReducedMotion = useReducedMotion();

  return (
    <section
      aria-labelledby="why-come-title"
      className="bg-background py-14 md:py-20"
    >
      <div className="content-container">
        <div className="grid items-stretch gap-7 lg:grid-cols-12 lg:gap-10">
          <motion.figure
            className="relative overflow-hidden rounded-4xl border border-border/70 bg-card shadow-sm lg:col-span-5"
            initial={prefersReducedMotion ? undefined : { opacity: 0, y: 18 }}
            whileInView={
              prefersReducedMotion ? undefined : { opacity: 1, y: 0 }
            }
            viewport={{ once: true, amount: 0.35 }}
            transition={
              prefersReducedMotion
                ? undefined
                : { duration: 0.6, ease: 'easeOut' }
            }
          >
            <div className="relative h-80 lg:h-full lg:min-h-128">
              <Image
                src="/assets/examples/accueil/eba-hero-2.png"
                alt="Ambiance chaleureuse du lieu EBA pour une pause cafe a Abidjan"
                fill
                sizes="(max-width: 1024px) 100vw, 42vw"
                className="object-cover object-center"
              />
              <div
                aria-hidden="true"
                className="absolute inset-0 bg-linear-to-t from-black/45 via-black/12 to-transparent"
              />
            </div>
          </motion.figure>

          <motion.div
            className="lg:col-span-7"
            initial={prefersReducedMotion ? undefined : { opacity: 0, y: 20 }}
            whileInView={
              prefersReducedMotion ? undefined : { opacity: 1, y: 0 }
            }
            viewport={{ once: true, amount: 0.3 }}
            transition={
              prefersReducedMotion
                ? undefined
                : { duration: 0.6, ease: 'easeOut', delay: 0.05 }
            }
          >
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
              Pourquoi venir chez EBA
            </p>
            <h2
              id="why-come-title"
              className="mt-3 max-w-3xl text-3xl font-semibold tracking-tight sm:text-4xl"
            >
              Plus qu&apos;un coffee shop, un endroit ou l&apos;on aime revenir
            </h2>

            <ul role="list" className="mt-7 space-y-3">
              {reasons.map((item, index) => (
                <motion.li
                  key={item.title}
                  className="rounded-2xl border border-border/70 bg-white/75 px-4 py-4 backdrop-blur-xs"
                  initial={
                    prefersReducedMotion ? undefined : { opacity: 0, x: 14 }
                  }
                  whileInView={
                    prefersReducedMotion ? undefined : { opacity: 1, x: 0 }
                  }
                  viewport={{ once: true, amount: 0.4 }}
                  transition={
                    prefersReducedMotion
                      ? undefined
                      : {
                          duration: 0.45,
                          ease: 'easeOut',
                          delay: 0.08 + index * 0.07,
                        }
                  }
                >
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/12 text-xs font-semibold text-primary">
                      0{index + 1}
                    </span>
                    <div>
                      <h3 className="text-sm font-semibold text-foreground md:text-base">
                        {item.title}
                      </h3>
                      <p className="mt-1 text-sm leading-relaxed text-foreground/75">
                        {item.text}
                      </p>
                    </div>
                  </div>
                </motion.li>
              ))}
            </ul>

            <div className="mt-7">
              <Button as={Link} href="/contact" color="primary" radius="full">
                Je reserve ma pause
              </Button>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

export default WhyComeSection;
