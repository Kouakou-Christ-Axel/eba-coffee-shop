'use client';

import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';

const trustItems = [
  'Café de spécialité',
  'Pâtisseries faites maison',
  'Ingrédients frais du marché',
  'Zéro conservateur',
  'Cocody, Abidjan',
];

function TrustStrip() {
  return (
    <div className="flex shrink-0 items-center" aria-hidden="true">
      {trustItems.map((item, i) => (
        <React.Fragment key={i}>
          <span className="whitespace-nowrap text-sm font-medium tracking-tight text-foreground/65 sm:text-[0.9rem]">
            {item}
          </span>
          <span className="mx-5 h-1 w-1 shrink-0 rounded-full bg-secondary/50 sm:mx-7" />
        </React.Fragment>
      ))}
    </div>
  );
}

function QuickTrustSection() {
  const reduceMotion = useReducedMotion();

  return (
    <section
      aria-labelledby="quick-trust-title"
      className="overflow-hidden border-y border-foreground/5 bg-background py-4 md:py-5"
    >
      <h2 id="quick-trust-title" className="sr-only">
        Café et pâtisserie artisanale à Abidjan — EBA Coffee Shop
      </h2>

      {/* Accessible static version for screen readers */}
      <ul className="sr-only" role="list">
        {trustItems.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>

      <motion.div
        className={`flex w-max ${reduceMotion ? '' : 'animate-[marquee_28s_linear_infinite]'}`}
        initial={reduceMotion ? undefined : { opacity: 0 }}
        whileInView={reduceMotion ? undefined : { opacity: 1 }}
        viewport={{ once: true }}
        transition={reduceMotion ? undefined : { duration: 0.6 }}
      >
        <TrustStrip />
        <TrustStrip />
      </motion.div>
    </section>
  );
}

export default QuickTrustSection;
