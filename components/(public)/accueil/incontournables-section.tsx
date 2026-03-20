'use client';

import Image from 'next/image';
import React from 'react';
import { Button, Card, CardBody, CardFooter, Link } from '@heroui/react';

type IncontournableItem = {
  name: string;
  price: number;
  imageSrc: string;
  imageAlt: string;
  imagePositionClassName?: string;
};

const incontournables: IncontournableItem[] = [
  {
    name: 'Cappuccino Signature',
    price: 3500,
    imageSrc: '/assets/examples/accueil/eba-hero-2.png',
    imageAlt: 'Cappuccino crema onctueuse',
    imagePositionClassName: 'object-center',
  },
  {
    name: 'Latte Vanille',
    price: 4000,
    imageSrc: '/assets/examples/accueil/eba-hero-2.png',
    imageAlt: 'Latte vanille servi chaud',
    imagePositionClassName: 'object-left',
  },
  {
    name: 'Croissant Amande',
    price: 2500,
    imageSrc: '/assets/examples/accueil/eba-hero.webp',
    imageAlt: 'Croissant amande croustillant',
    imagePositionClassName: 'object-right',
  },
];

const priceFormatter = new Intl.NumberFormat('fr-FR');

function IncontournablesSection() {
  return (
    <section
      className="bg-background py-14 md:py-20"
      aria-labelledby="incontournables-title"
    >
      <div className="content-container px-6">
        <div className="mb-8 flex flex-col gap-3 md:mb-10">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            Les favoris EBA
          </p>
          <h2
            id="incontournables-title"
            className="text-3xl font-bold sm:text-4xl"
          >
            Nos incontournables
          </h2>
          <p className="max-w-2xl text-sm text-foreground/75 md:text-base">
            Les 4 patisseries et boissons les plus aimees, selectionnees pour
            une experience intense et gourmande.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {incontournables.map((item) => (
            <Card key={item.name} className="overflow-hidden border">
              <div className="relative h-80 w-full overflow-hidden">
                <Image
                  src={item.imageSrc}
                  alt={item.imageAlt}
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                  className={`object-cover transition-transform duration-500 hover:scale-105 ${item.imagePositionClassName ?? ''}`}
                />
              </div>

              <CardBody className="gap-2 px-5 py-4">
                <h3 className="text-lg font-semibold">{item.name}</h3>
                <p className="text-base font-medium text-primary">
                  {priceFormatter.format(item.price)} FCFA
                </p>
              </CardBody>

              <CardFooter className="pt-0 pb-5 px-5">
                <Button
                  as={Link}
                  href="/contact"
                  color="primary"
                  variant="solid"
                  className="w-full"
                  aria-label={`Je commande ${item.name}`}
                >
                  Je commande
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

export default IncontournablesSection;
