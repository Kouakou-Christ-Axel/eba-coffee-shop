'use client';

import React, { useRef } from 'react';
import Image from 'next/image';
import { Button, Card, CardBody, Link } from '@heroui/react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { MapPin, MessageCircle, Phone } from 'lucide-react';

gsap.registerPlugin(useGSAP, ScrollTrigger);

const quickAccessItems = [
  {
    label: 'WhatsApp',
    value: '+225 07 00 00 00 00',
    icon: MessageCircle,
    cta: 'Ecrire sur WhatsApp',
    href: 'https://wa.me/2250700000000',
    external: true,
  },
  {
    label: 'Telephone',
    value: '+225 27 22 00 00 00',
    icon: Phone,
    cta: 'Appeler',
    href: 'tel:+2252722000000',
    external: false,
  },
  {
    label: 'Itineraire',
    value: 'Boulevard Latrille, Cocody, Abidjan',
    icon: MapPin,
    cta: "Voir l'itineraire",
    href: 'https://maps.google.com/?q=Boulevard+Latrille+Cocody+Abidjan',
    external: true,
  },
];

function ContactQuickAccessSection() {
  const sectionRef = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();

      mm.add('(prefers-reduced-motion: no-preference)', () => {
        gsap.from('.quick-access-card', {
          x: -30,
          opacity: 0,
          stagger: 0.12,
          duration: 0.7,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: '.quick-access-cards',
            start: 'top 80%',
          },
        });

        gsap.from('.quick-access-image', {
          x: 30,
          opacity: 0,
          duration: 0.8,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: '.quick-access-image',
            start: 'top 80%',
          },
        });
      });
    },
    { scope: sectionRef }
  );

  return (
    <section
      ref={sectionRef}
      aria-labelledby="quick-access-title"
      className="bg-[linear-gradient(180deg,rgba(255,252,248,1)_0%,rgba(250,246,242,1)_100%)] py-14 md:py-20"
    >
      <div className="content-container px-6">
        <h2
          id="quick-access-title"
          className="mb-8 text-3xl font-bold tracking-tight sm:text-4xl"
        >
          Nous contacter
        </h2>

        <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
          <ul className="quick-access-cards space-y-4" role="list">
            {quickAccessItems.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.label} className="quick-access-card">
                  <Card className="border border-default-200/70 bg-content1/90 shadow-sm">
                    <CardBody className="flex flex-row items-center gap-4 p-5">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10">
                        <Icon
                          aria-hidden="true"
                          className="h-5 w-5 text-primary"
                        />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-foreground">
                          {item.label}
                        </p>
                        <p className="text-sm text-foreground/75">
                          {item.value}
                        </p>
                      </div>
                      <Button
                        as={Link}
                        href={item.href}
                        {...(item.external
                          ? { target: '_blank', rel: 'noopener noreferrer' }
                          : {})}
                        color="primary"
                        variant="flat"
                        radius="full"
                        size="sm"
                      >
                        {item.cta}
                      </Button>
                    </CardBody>
                  </Card>
                </li>
              );
            })}
          </ul>

          <div className="quick-access-image">
            <Card className="overflow-hidden border border-default-200/70 bg-content1 shadow-xl">
              <div className="relative h-72 w-full sm:h-80 lg:h-full lg:min-h-80">
                <Image
                  src="/assets/examples/accueil/eba-hero-2.png"
                  alt="Interieur chaleureux du coffee shop EBA"
                  fill
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  className="object-cover"
                />
              </div>
            </Card>
          </div>
        </div>
      </div>
    </section>
  );
}

export default ContactQuickAccessSection;
