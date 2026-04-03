'use client';

import React, { useRef } from 'react';
import { Card, CardBody } from '@heroui/react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Clock3, MapPin } from 'lucide-react';

gsap.registerPlugin(useGSAP, ScrollTrigger);

const infoItems = [
  {
    icon: MapPin,
    label: 'Adresse',
    value: 'Boulevard Latrille, Cocody, Abidjan',
  },
  {
    icon: MapPin,
    label: 'Repere',
    value: 'A 2 min du carrefour Duncan',
  },
  {
    icon: Clock3,
    label: 'Horaires',
    value: 'Lun - Dim : 7h30 - 21h30',
  },
];

function ContactMapSection() {
  const sectionRef = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();

      mm.add('(prefers-reduced-motion: no-preference)', () => {
        gsap.from('.map-iframe', {
          opacity: 0,
          duration: 0.8,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: '.map-iframe',
            start: 'top 85%',
          },
        });

        gsap.from('.map-info-card', {
          y: 30,
          opacity: 0,
          duration: 0.7,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: '.map-info-card',
            start: 'top 90%',
          },
        });
      });
    },
    { scope: sectionRef }
  );

  return (
    <section ref={sectionRef} aria-labelledby="map-section-title">
      <h2 id="map-section-title" className="sr-only">
        Nous trouver
      </h2>

      <div className="relative h-80 w-full md:h-96">
        <iframe
          title="Carte Google Maps EBA a Abidjan"
          src="https://www.google.com/maps?q=Boulevard+Latrille+Cocody+Abidjan&output=embed"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          className="map-iframe h-full w-full border-0"
        />

        <Card className="map-info-card absolute bottom-4 left-4 right-4 border border-default-200/70 bg-content1/95 shadow-lg backdrop-blur-md sm:left-6 sm:right-auto sm:max-w-sm">
          <CardBody className="gap-3 p-5">
            {infoItems.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.label} className="flex items-start gap-3">
                  <Icon
                    aria-hidden="true"
                    className="mt-0.5 h-4.5 w-4.5 shrink-0 text-primary"
                  />
                  <div className="text-sm">
                    <p className="font-medium text-foreground">{item.label}</p>
                    <p className="text-foreground/75">{item.value}</p>
                  </div>
                </div>
              );
            })}
          </CardBody>
        </Card>
      </div>
    </section>
  );
}

export default ContactMapSection;
