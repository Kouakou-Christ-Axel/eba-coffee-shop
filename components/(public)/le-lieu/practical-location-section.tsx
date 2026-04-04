'use client';

import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Button, Link } from '@heroui/react';
import { Clock3, MapPin, MessageCircle } from 'lucide-react';
import { brandConfig } from '@/config/brand.config';

const infoRows = [
  {
    label: 'Adresse',
    value: brandConfig.location.address,
    icon: MapPin,
  },
  {
    label: 'Quartier',
    value: brandConfig.location.district,
    icon: MapPin,
  },
  {
    label: 'Horaires',
    value: brandConfig.location.schedule,
    icon: Clock3,
  },
  {
    label: 'Telephone / WhatsApp',
    value: `${brandConfig.location.phone} - ${brandConfig.location.whatsapp}`,
    icon: MessageCircle,
  },
];

function PracticalLocationSection() {
  const reduceMotion = useReducedMotion();

  return (
    <section
      id="infos-pratiques"
      aria-labelledby="practical-location-title"
      className="bg-[linear-gradient(180deg,rgba(255,252,248,1)_0%,rgba(248,243,238,1)_100%)] py-12 md:py-16"
    >
      <div className="content-container">
        <div className="grid gap-6 lg:grid-cols-12 lg:items-start lg:gap-8">
          <motion.div
            className="rounded-3xl border border-border/70 bg-white p-5 shadow-sm sm:p-6 lg:col-span-5"
            initial={reduceMotion ? undefined : { opacity: 0, y: 16 }}
            whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.35 }}
            transition={
              reduceMotion ? undefined : { duration: 0.6, ease: 'easeOut' }
            }
          >
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
              Infos pratiques
            </p>
            <h2
              id="practical-location-title"
              className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl"
            >
              Infos pratiques + localisation
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-foreground/75">
              Tout est ici pour venir facilement chez EBA et profiter d&apos;une
              pause cafe ou patisserie a Abidjan.
            </p>

            <ul role="list" className="mt-5 space-y-2.5">
              {infoRows.map((item, index) => {
                const Icon = item.icon;
                return (
                  <motion.li
                    key={item.label}
                    className="rounded-2xl border border-border/70 bg-default-50 px-3.5 py-3"
                    initial={reduceMotion ? undefined : { opacity: 0, y: 10 }}
                    whileInView={
                      reduceMotion ? undefined : { opacity: 1, y: 0 }
                    }
                    viewport={{ once: true, amount: 0.35 }}
                    transition={
                      reduceMotion
                        ? undefined
                        : {
                            duration: 0.45,
                            ease: 'easeOut',
                            delay: 0.1 + index * 0.06,
                          }
                    }
                  >
                    <div className="flex items-start gap-2.5">
                      <Icon
                        aria-hidden="true"
                        className="mt-0.5 h-4 w-4 shrink-0 text-primary"
                      />
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-foreground/60">
                          {item.label}
                        </p>
                        <p className="mt-0.5 text-sm font-medium text-foreground">
                          {item.value}
                        </p>
                      </div>
                    </div>
                  </motion.li>
                );
              })}
            </ul>

            <div className="mt-5 flex flex-wrap gap-2.5">
              <Button
                as={Link}
                href={brandConfig.location.mapsLink}
                target="_blank"
                rel="noopener noreferrer"
                radius="full"
                color="primary"
                startContent={<MapPin aria-hidden="true" className="h-4 w-4" />}
              >
                Itineraire
              </Button>
              <Button
                as={Link}
                href={brandConfig.location.whatsappLink}
                target="_blank"
                rel="noopener noreferrer"
                radius="full"
                variant="bordered"
                color="secondary"
                startContent={
                  <MessageCircle aria-hidden="true" className="h-4 w-4" />
                }
              >
                WhatsApp
              </Button>
            </div>
          </motion.div>

          <motion.div
            className="overflow-hidden rounded-3xl border border-border/70 bg-white shadow-sm lg:col-span-7"
            initial={reduceMotion ? undefined : { opacity: 0 }}
            whileInView={reduceMotion ? undefined : { opacity: 1 }}
            viewport={{ once: true, amount: 0.25 }}
            transition={
              reduceMotion
                ? undefined
                : { duration: 0.7, ease: 'easeOut', delay: 0.16 }
            }
          >
            <div className="border-b border-border/70 px-4 py-3 sm:px-5">
              <p className="text-sm font-medium text-foreground">
                Localisation EBA
              </p>
              <p className="mt-0.5 text-xs text-foreground/65">
                {brandConfig.location.address} - {brandConfig.location.landmark}
              </p>
            </div>
            <div className="relative h-72 w-full sm:h-88 lg:h-124">
              <iframe
                title="Carte Google Maps EBA a Abidjan"
                src={brandConfig.location.mapsEmbed}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                className="h-full w-full border-0"
              />
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

export default PracticalLocationSection;
