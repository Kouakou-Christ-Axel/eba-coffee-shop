'use client';

import React from 'react';
import { Button, Link } from '@heroui/react';
import { motion, useReducedMotion } from 'framer-motion';
import { Clock3, MapPin } from 'lucide-react';
import { brandConfig } from '@/config/brand.config';

function ContactMapSection() {
  const reduceMotion = useReducedMotion();

  return (
    <section aria-labelledby="map-section-title" className="relative">
      <h2 id="map-section-title" className="sr-only">
        Nous trouver
      </h2>

      <div className="relative h-80 w-full md:h-[28rem]">
        <iframe
          title="Carte Google Maps EBA a Abidjan"
          src={brandConfig.links.maps.embed}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          className="h-full w-full border-0"
        />

        <motion.div
          className="absolute bottom-4 left-4 max-w-xs rounded-xl bg-background/95 p-4 shadow-lg backdrop-blur-md md:bottom-6 md:left-6 md:p-5"
          initial={reduceMotion ? undefined : { opacity: 0, y: 12 }}
          whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={
            reduceMotion
              ? undefined
              : { duration: 0.6, ease: 'easeOut', delay: 0.3 }
          }
        >
          <div className="space-y-2.5">
            <div className="flex items-start gap-2.5">
              <Clock3
                aria-hidden="true"
                className="mt-0.5 h-4 w-4 shrink-0 text-primary"
              />
              <p className="text-sm font-medium text-foreground">
                {brandConfig.links.contact.hours}
              </p>
            </div>
            <div className="flex items-start gap-2.5">
              <MapPin
                aria-hidden="true"
                className="mt-0.5 h-4 w-4 shrink-0 text-primary"
              />
              <p className="text-sm text-foreground/75">
                {brandConfig.links.contact.landmark}
              </p>
            </div>
          </div>

          <Button
            as={Link}
            href={brandConfig.links.maps.directions}
            target="_blank"
            rel="noopener noreferrer"
            variant="bordered"
            color="secondary"
            radius="full"
            size="sm"
            className="mt-3"
          >
            Voir l&apos;itineraire
          </Button>
        </motion.div>
      </div>
    </section>
  );
}

export default ContactMapSection;
