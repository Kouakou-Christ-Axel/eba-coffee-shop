'use client';

import Image from 'next/image';
import React from 'react';
import { Link } from '@heroui/react';
import { motion, useReducedMotion } from 'framer-motion';
import { MapPin, MessageCircle, Phone } from 'lucide-react';
import { brandConfig } from '@/config/brand.config';

const contactCards = [
  {
    label: 'WhatsApp',
    value: brandConfig.links.contact.whatsapp.display,
    icon: MessageCircle,
    href: brandConfig.links.contact.whatsapp.href,
    external: true,
    color: 'bg-primary/10 text-primary',
  },
  {
    label: 'Téléphone',
    value: brandConfig.links.contact.phone.display,
    icon: Phone,
    href: brandConfig.links.contact.phone.href,
    external: false,
    color: 'bg-secondary/10 text-secondary',
  },
  {
    label: 'Nous trouver',
    value: brandConfig.links.contact.landmark,
    icon: MapPin,
    href: brandConfig.links.maps.directions,
    external: true,
    color: 'bg-primary/10 text-primary',
  },
];

function ContactHeroSection() {
  const reduceMotion = useReducedMotion();

  const fadeUp = reduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: 20 } as const,
        whileInView: { opacity: 1, y: 0 } as const,
        viewport: { once: true },
        transition: { duration: 0.6, ease: 'easeOut' as const },
      };

  return (
    <section
      aria-labelledby="contact-hero-title"
      className="relative isolate min-h-screen overflow-hidden"
    >
      <Image
        src="/assets/examples/accueil/eba-hero.webp"
        alt="Ambiance chaleureuse du coffee shop EBA à Cocody, Abidjan"
        fill
        priority
        className="object-cover"
        sizes="100vw"
      />

      <div
        className="absolute inset-0 bg-linear-to-b from-black/70 via-black/55 to-black/70"
        aria-hidden="true"
      />
      <div
        className="absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(122,80,255,0.2),transparent_50%)]"
        aria-hidden="true"
      />

      <div className="relative z-10 flex min-h-screen items-center">
        <div className="content-container w-full px-6 py-20 md:py-24">
          <motion.div
            className="mx-auto max-w-3xl text-center text-white"
            {...fadeUp}
          >
            <span className="inline-block rounded-full border border-white/35 bg-white/10 px-4 py-1 text-xs uppercase tracking-[0.2em] text-white/90 backdrop-blur-sm">
              Contact
            </span>

            <motion.h1
              id="contact-hero-title"
              className="mt-5 text-balance text-3xl font-semibold leading-tight sm:text-4xl md:text-5xl"
              {...fadeUp}
              transition={
                reduceMotion
                  ? undefined
                  : { duration: 0.6, ease: 'easeOut', delay: 0.1 }
              }
            >
              Contactez EBA Coffee Shop à Abidjan
            </motion.h1>

            <motion.p
              className="mx-auto mt-4 max-w-2xl text-pretty text-base text-white/85 sm:text-lg"
              {...fadeUp}
              transition={
                reduceMotion
                  ? undefined
                  : { duration: 0.6, ease: 'easeOut', delay: 0.2 }
              }
            >
              On vous répond en moins d&apos;une heure sur WhatsApp
            </motion.p>
          </motion.div>

          <div className="mx-auto mt-10 max-w-5xl">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {contactCards.map((card, index) => {
                const Icon = card.icon;
                return (
                  <motion.div
                    key={card.label}
                    initial={reduceMotion ? undefined : { opacity: 0, y: 20 }}
                    whileInView={
                      reduceMotion ? undefined : { opacity: 1, y: 0 }
                    }
                    viewport={{ once: true }}
                    transition={
                      reduceMotion
                        ? undefined
                        : {
                            duration: 0.5,
                            ease: 'easeOut',
                            delay: 0.28 + index * 0.08,
                          }
                    }
                  >
                    <Link
                      href={card.href}
                      {...(card.external
                        ? { target: '_blank', rel: 'noopener noreferrer' }
                        : {})}
                      className="group block rounded-2xl border border-white/20 bg-white/90 p-5 text-center shadow-xl shadow-black/25 backdrop-blur-sm transition duration-300 hover:-translate-y-1 hover:bg-white hover:shadow-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 md:p-6"
                    >
                      <div
                        className={`mx-auto flex h-12 w-12 items-center justify-center rounded-full ${card.color}`}
                      >
                        <Icon aria-hidden="true" className="h-5 w-5" />
                      </div>
                      <p className="mt-3 text-sm font-semibold uppercase tracking-wide text-foreground/70">
                        {card.label}
                      </p>
                      <p className="mt-1 text-sm font-medium text-foreground group-hover:text-foreground/90">
                        {card.value}
                      </p>
                    </Link>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default ContactHeroSection;
