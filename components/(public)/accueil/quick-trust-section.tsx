'use client';

import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Card, CardBody } from '@heroui/react';
import {
  CakeSlice,
  Coffee,
  MapPin,
  MessageCircle,
  type LucideIcon,
} from 'lucide-react';

type TrustItem = {
  label: string;
  Icon: LucideIcon;
  accentClassName: string;
};

const trustItems: TrustItem[] = [
  {
    label: "Cafe d'exception",
    Icon: Coffee,
    accentClassName: 'from-amber-300/35 to-orange-400/15',
  },
  {
    label: 'Patisseries maison',
    Icon: CakeSlice,
    accentClassName: 'from-rose-300/30 to-orange-300/15',
  },
  {
    label: 'Commande WhatsApp',
    Icon: MessageCircle,
    accentClassName: 'from-emerald-300/30 to-cyan-300/10',
  },
  {
    label: 'A Abidjan',
    Icon: MapPin,
    accentClassName: 'from-sky-300/30 to-indigo-300/15',
  },
];

function QuickTrustSection() {
  const prefersReducedMotion = useReducedMotion();

  return (
    <section
      className="relative overflow-hidden bg-[radial-gradient(circle_at_top,rgba(255,214,153,0.12),transparent_45%),linear-gradient(180deg,rgba(17,24,39,1)_0%,rgba(11,15,23,1)_100%)] py-12 md:py-16"
      aria-labelledby="quick-trust-title"
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-amber-200/60 to-transparent"
        aria-hidden="true"
      />

      <div className="mx-auto w-full max-w-6xl px-6">
        <h2 id="quick-trust-title" className="sr-only">
          Cafe et patisserie a Abidjan - EBA
        </h2>

        <ul
          className="grid grid-cols-2 gap-8 md:grid-cols-4 md:gap-10"
          role="list"
        >
          {trustItems.map((item, index) => (
            <motion.li
              key={item.label}
              initial={prefersReducedMotion ? false : { opacity: 0, y: 16 }}
              whileInView={prefersReducedMotion ? {} : { opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.35 }}
              transition={{
                duration: 0.4,
                delay: index * 0.08,
                ease: 'easeOut',
              }}
              className="group"
            >
              <Card className="relative overflow-hidden border border-white/15 bg-white/8 backdrop-blur-md transition duration-300 md:hover:-translate-y-0.5 md:hover:scale-105 md:hover:border-amber-200/35">
                <div
                  className={`pointer-events-none absolute inset-0 bg-linear-to-br ${item.accentClassName} opacity-0 transition duration-300 group-hover:opacity-100`}
                  aria-hidden="true"
                />
                <CardBody className="relative flex min-h-32 flex-col items-center justify-center px-4 py-6 text-center md:min-h-36">
                  <item.Icon
                    aria-hidden="true"
                    className="h-6 w-6 text-primary-500"
                  />
                  <p className="mt-3 text-sm font-medium text-white md:text-base">
                    {item.label}
                  </p>
                </CardBody>
              </Card>
            </motion.li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export default QuickTrustSection;
