'use client';

import React from 'react';
import { Button, Card, CardBody, Link } from '@heroui/react';
import { motion, useReducedMotion } from 'framer-motion';
import { Clock3, MapPin, MessageCircle, Phone } from 'lucide-react';

const infoRows = [
  {
    label: 'Adresse',
    value: 'Boulevard Latrille, Cocody, Abidjan',
    icon: MapPin,
  },
  {
    label: 'Repere',
    value: 'A 2 min du carrefour Duncan',
    icon: MapPin,
  },
  {
    label: 'Horaires',
    value: 'Lun - Dim : 7h30 - 21h30',
    icon: Clock3,
  },
  {
    label: 'WhatsApp',
    value: '+225 07 00 00 00 00',
    icon: MessageCircle,
  },
  {
    label: 'Telephone',
    value: '+225 27 22 00 00 00',
    icon: Phone,
  },
];

function FindUsSection() {
  const reduceMotion = useReducedMotion();

  const fadeUp = reduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: 20 },
        whileInView: { opacity: 1, y: 0 },
        viewport: { once: true, amount: 0.35 },
        transition: { duration: 0.65, ease: 'easeOut' as const },
      };

  return (
    <section
      className="bg-[linear-gradient(180deg,rgba(255,252,248,1)_0%,rgba(250,246,242,1)_100%)] py-14 md:py-20"
      aria-labelledby="find-us-title"
    >
      <div className="content-container px-6">
        <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
          <div>
            <motion.h2
              id="find-us-title"
              className="text-3xl font-bold tracking-tight sm:text-4xl"
              {...fadeUp}
            >
              Nous trouver a Abidjan
            </motion.h2>

            <motion.p
              className="mt-4 max-w-2xl text-sm leading-relaxed text-foreground/80 sm:text-base"
              {...fadeUp}
              transition={
                reduceMotion
                  ? undefined
                  : { duration: 0.65, ease: 'easeOut', delay: 0.1 }
              }
            >
              Retrouvez EBA pour une pause cafe et patisserie dans un cadre
              elegant et chaleureux a Abidjan.
            </motion.p>

            <motion.address
              className="mt-6 not-italic"
              initial={reduceMotion ? undefined : { opacity: 0, y: 16 }}
              whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={
                reduceMotion
                  ? undefined
                  : { duration: 0.6, ease: 'easeOut', delay: 0.16 }
              }
            >
              <ul className="space-y-3" role="list">
                {infoRows.map((row, index) => {
                  const Icon = row.icon;
                  return (
                    <motion.li
                      key={row.label}
                      className="flex items-start gap-3 rounded-xl border border-default-200/70 bg-content1/90 px-4 py-3"
                      initial={reduceMotion ? undefined : { opacity: 0, y: 12 }}
                      whileInView={
                        reduceMotion ? undefined : { opacity: 1, y: 0 }
                      }
                      viewport={{ once: true, amount: 0.4 }}
                      transition={
                        reduceMotion
                          ? undefined
                          : {
                              duration: 0.45,
                              ease: 'easeOut',
                              delay: 0.2 + index * 0.07,
                            }
                      }
                    >
                      <Icon
                        aria-hidden="true"
                        className="mt-0.5 h-4.5 w-4.5 shrink-0 text-primary"
                      />
                      <div className="text-sm sm:text-base">
                        <p className="font-medium text-foreground">
                          {row.label}
                        </p>
                        <p className="text-foreground/75">{row.value}</p>
                      </div>
                    </motion.li>
                  );
                })}
              </ul>
            </motion.address>

            <motion.div
              className="mt-6 flex flex-wrap gap-3"
              initial={reduceMotion ? undefined : { opacity: 0, y: 12 }}
              whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={
                reduceMotion
                  ? undefined
                  : { duration: 0.55, ease: 'easeOut', delay: 0.3 }
              }
            >
              <Button
                as={Link}
                href="https://wa.me/2250700000000"
                target="_blank"
                rel="noopener noreferrer"
                color="primary"
                radius="full"
                startContent={
                  <MessageCircle aria-hidden="true" className="h-4 w-4" />
                }
              >
                Commander via WhatsApp
              </Button>
              <Button
                as={Link}
                href="https://maps.google.com/?q=Boulevard+Latrille+Cocody+Abidjan"
                target="_blank"
                rel="noopener noreferrer"
                variant="bordered"
                color="secondary"
                radius="full"
              >
                Voir l&apos;itineraire
              </Button>
            </motion.div>
          </div>

          <motion.div
            initial={reduceMotion ? undefined : { opacity: 0 }}
            whileInView={reduceMotion ? undefined : { opacity: 1 }}
            viewport={{ once: true, amount: 0.25 }}
            transition={
              reduceMotion
                ? undefined
                : { duration: 0.8, ease: 'easeOut', delay: 0.2 }
            }
          >
            <Card className="overflow-hidden rounded-2xl border border-default-200/70 bg-content1 shadow-lg">
              <CardBody className="p-0">
                <div className="relative h-80 w-full md:h-128">
                  <iframe
                    title="Carte Google Maps EBA a Abidjan"
                    src="https://www.google.com/maps?q=Boulevard+Latrille+Cocody+Abidjan&output=embed"
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    className="h-full w-full border-0"
                  />
                </div>
              </CardBody>
            </Card>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

export default FindUsSection;
