'use client';

import React from 'react';
import Image from 'next/image';
import { Button, Card, CardBody, Link } from '@heroui/react';

function UniversEbaSection() {
  return (
    <section
      className="bg-muted/35 py-14 md:py-20"
      aria-labelledby="univers-eba-title"
    >
      <div className="content-container px-6">
        <div className="grid items-center gap-8 lg:grid-cols-2 lg:gap-12">
          <Card className="overflow-hidden border border-default-200/70 bg-content1 shadow-xl">
            <div className="relative h-72 w-full sm:h-80 lg:h-120">
              <Image
                src="/assets/examples/accueil/eba-hero.webp"
                alt="Univers editorial chaleureux du coffee shop EBA"
                fill
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="object-cover"
              />
            </div>
          </Card>

          <Card className="border border-default-200/70 bg-content1/90 shadow-lg">
            <CardBody className="gap-5 p-7 sm:p-10">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                L&apos;esprit EBA
              </p>

              <h2
                id="univers-eba-title"
                className="text-3xl font-bold leading-tight sm:text-4xl"
              >
                L&apos;univers EBA
              </h2>

              <p className="max-w-xl text-sm leading-relaxed text-foreground/80 sm:text-base">
                EBA imagine une experience ou cafe, patisserie et elegance se
                rencontrent dans un esprit chaleureux, raffine et profondement
                ancre a Abidjan.
              </p>

              <div>
                <Button
                  as={Link}
                  color="secondary"
                  href="/a-propos"
                  // variant="flat"
                  variant="bordered"
                  // radius="full"
                  className="px-7"
                >
                  Decouvrir notre univers
                </Button>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    </section>
  );
}

export default UniversEbaSection;
