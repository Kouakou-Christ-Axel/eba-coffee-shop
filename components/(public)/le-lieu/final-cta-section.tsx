'use client';

import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Button, Link } from '@heroui/react';
import { Compass, Clock3 } from 'lucide-react';
import { brandConfig } from '@/config/brand.config';

function FinalCtaSection() {
  const reduceMotion = useReducedMotion();

  return (
    <section className="py-12 md:py-16" aria-labelledby="final-cta-title">
      <div className="content-container">
        <motion.div
          className="relative overflow-hidden rounded-4xl bg-[linear-gradient(135deg,#2A1D3A_0%,#1A1325_100%)] px-5 py-10 text-center text-white shadow-xl sm:px-8 md:py-12"
          initial={reduceMotion ? undefined : { opacity: 0, y: 18 }}
          whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.45 }}
          transition={
            reduceMotion ? undefined : { duration: 0.65, ease: 'easeOut' }
          }
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-20 left-1/2 h-48 w-48 -translate-x-1/2 rounded-full bg-primary/30 blur-3xl"
          />

          <div className="relative z-10 mx-auto max-w-3xl">
            <h2
              id="final-cta-title"
              className="text-balance text-2xl font-semibold tracking-tight sm:text-3xl md:text-4xl"
            >
              Envie de decouvrir l&apos;atmosphere EBA ?
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-white/85 sm:text-base">
              Passez nous voir pour un cafe, une douceur et un vrai moment de
              pause.
            </p>

            <div className="mt-7 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
              <Button
                as={Link}
                href={brandConfig.location.mapsLink}
                target="_blank"
                rel="noopener noreferrer"
                radius="full"
                color="primary"
                className="font-medium"
                startContent={
                  <Compass aria-hidden="true" className="h-4 w-4" />
                }
              >
                Nous trouver
              </Button>
              <Button
                as={Link}
                href="#infos-pratiques"
                radius="full"
                variant="bordered"
                className="border-white/35 bg-white/5 text-white hover:bg-white/10"
                startContent={<Clock3 aria-hidden="true" className="h-4 w-4" />}
              >
                Voir les horaires
              </Button>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

export default FinalCtaSection;
