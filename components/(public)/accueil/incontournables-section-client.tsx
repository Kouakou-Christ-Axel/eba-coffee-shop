'use client';

import { MediaImage as Image } from '@/components/ui/media-image';
import React from 'react';
import { Button, Card, CardBody, CardFooter, Chip, Link } from '@heroui/react';
import { motion, useReducedMotion } from 'framer-motion';

import { brandConfig } from '@/config/brand.config';

export type FeaturedProduct = {
  id: string;
  name: string;
  description: string;
  price: number;
  imageUrl: string | null;
  featuredBadge: string | null;
};

type Props = {
  items: FeaturedProduct[];
};

const FALLBACK_IMAGE = '/assets/examples/accueil/eba-hero.webp';

const badgeColorMap: Record<string, 'primary' | 'secondary' | 'success'> = {
  'Best-seller': 'primary',
  'Coup de cœur': 'secondary',
  Nouveau: 'success',
};

const priceFormatter = new Intl.NumberFormat('fr-FR');

function buildWhatsAppOrderLink(itemName: string) {
  const base = brandConfig.links.contact.whatsapp.href;
  const message = `Bonjour EBA, je souhaite commander : ${itemName}.`;
  const separator = base.includes('?') ? '&' : '?';
  return `${base}${separator}text=${encodeURIComponent(message)}`;
}

function IncontournablesSectionClient({ items }: Props) {
  const reduceMotion = useReducedMotion();

  return (
    <section
      className="bg-background py-14 md:py-20"
      aria-labelledby="incontournables-title"
    >
      <div className="content-container px-6">
        <motion.div
          className="mb-8 flex flex-col gap-3 md:mb-10"
          initial={reduceMotion ? undefined : { opacity: 0, y: 16 }}
          whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        >
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            Les favoris EBA
          </p>
          <h2
            id="incontournables-title"
            className="text-3xl font-bold sm:text-4xl"
          >
            Ce qu’on aime vous servir
          </h2>
          <p className="max-w-2xl text-sm text-foreground/75 md:text-base">
            Les pâtisseries et boissons les plus aimées par nos habitués,
            préparées chaque matin à Cocody.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item, index) => {
            const badgeColor = item.featuredBadge
              ? (badgeColorMap[item.featuredBadge] ?? 'primary')
              : null;

            return (
              <motion.div
                key={item.id}
                initial={reduceMotion ? undefined : { opacity: 0, y: 16 }}
                whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{
                  duration: 0.6,
                  ease: 'easeOut',
                  delay: index * 0.1,
                }}
                className="h-full"
              >
                <Card
                  className="group h-full overflow-hidden border border-default-200 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
                  shadow="none"
                >
                  <div className="relative h-72 w-full overflow-hidden md:h-80">
                    <Image
                      src={item.imageUrl ?? FALLBACK_IMAGE}
                      alt={`${item.name} — EBA Coffee Shop Cocody Abidjan`}
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      className="object-cover object-center transition-transform duration-500 group-hover:scale-105"
                    />
                    {item.featuredBadge && badgeColor ? (
                      <Chip
                        size="sm"
                        color={badgeColor}
                        variant="solid"
                        className="absolute left-3 top-3 font-semibold shadow-md"
                      >
                        {item.featuredBadge}
                      </Chip>
                    ) : null}
                  </div>

                  <CardBody className="gap-2 px-5 py-4">
                    <h3 className="text-lg font-semibold">{item.name}</h3>
                    <p className="text-sm text-foreground/70">
                      {item.description}
                    </p>
                    <p className="mt-1 text-base font-semibold text-primary">
                      {priceFormatter.format(item.price)}
                      <span className="ml-1 text-xs font-medium text-foreground/60">
                        FCFA
                      </span>
                    </p>
                  </CardBody>

                  <CardFooter className="px-5 pb-5 pt-0">
                    <Button
                      as={Link}
                      href={buildWhatsAppOrderLink(item.name)}
                      isExternal
                      color="primary"
                      variant="solid"
                      className="w-full font-medium"
                      aria-label={`Commander ${item.name} sur WhatsApp`}
                    >
                      Je commande
                    </Button>
                  </CardFooter>
                </Card>
              </motion.div>
            );
          })}
        </div>

        <motion.div
          className="mt-10 flex justify-center"
          initial={reduceMotion ? undefined : { opacity: 0, y: 12 }}
          whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.6 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
        >
          <Button
            as={Link}
            href="/carte"
            color="primary"
            variant="bordered"
            size="lg"
            className="font-medium"
          >
            Voir toute la carte
          </Button>
        </motion.div>
      </div>
    </section>
  );
}

export default IncontournablesSectionClient;
