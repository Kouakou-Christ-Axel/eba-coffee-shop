'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { Clock3, MapPin, MessageCircle } from 'lucide-react';
import type { ContactSettings } from '@/lib/contact-settings';

export function ContactInfoCard({ contact }: { contact: ContactSettings }) {
  const reduceMotion = useReducedMotion();

  const infoItems = [
    {
      label: 'Adresse',
      value: contact.address,
      icon: MapPin,
    },
    {
      label: 'Horaires',
      value: contact.hoursLabel,
      icon: Clock3,
    },
    {
      label: 'WhatsApp',
      value: contact.whatsapp,
      icon: MessageCircle,
    },
  ];

  const containerProps = reduceMotion
    ? {}
    : ({
        initial: 'hidden' as const,
        whileInView: 'visible' as const,
        viewport: { once: true, amount: 0.25 },
        variants: {
          hidden: {},
          visible: { transition: { staggerChildren: 0.07 } },
        },
      } as const);

  const itemProps = reduceMotion
    ? {}
    : ({
        variants: {
          hidden: { opacity: 0, y: 18 },
          visible: {
            opacity: 1,
            y: 0,
            transition: { duration: 0.55, ease: 'easeOut' as const },
          },
        },
      } as const);

  return (
    <motion.div
      {...containerProps}
      className="rounded-3xl border border-default-200/70 bg-content1/80 p-6 shadow-lg shadow-black/5 backdrop-blur-sm md:p-8"
    >
      <motion.p
        className="text-xs font-semibold uppercase tracking-[0.2em] text-primary"
        {...itemProps}
      >
        Contact EBA
      </motion.p>
      <motion.h2
        id="contact-form-title"
        className="mt-3 text-balance text-3xl font-semibold tracking-tight sm:text-4xl"
        {...itemProps}
      >
        Ecrivons ensemble votre prochaine experience
      </motion.h2>
      <motion.p
        className="mt-4 max-w-xl text-sm leading-relaxed text-foreground/75 sm:text-base"
        {...itemProps}
      >
        Une question, une reservation ou un partenariat ? Notre equipe vous
        repond rapidement avec attention.
      </motion.p>

      <motion.ul className="mt-7 space-y-3" role="list" {...itemProps}>
        {infoItems.map((item) => {
          const Icon = item.icon;
          return (
            <li
              key={item.label}
              className="flex items-start gap-3 rounded-2xl border border-default-200/70 bg-background/70 px-4 py-3"
            >
              <span className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Icon aria-hidden="true" className="h-4 w-4" />
              </span>
              <div>
                <p className="text-xs uppercase tracking-wide text-foreground/60">
                  {item.label}
                </p>
                <p className="text-sm font-medium text-foreground/85">
                  {item.value}
                </p>
              </div>
            </li>
          );
        })}
      </motion.ul>
    </motion.div>
  );
}
