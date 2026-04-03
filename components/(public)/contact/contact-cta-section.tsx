'use client';

import React, { useRef } from 'react';
import { Button, Link } from '@heroui/react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { MessageCircle } from 'lucide-react';

gsap.registerPlugin(useGSAP, ScrollTrigger);

function ContactCtaSection() {
  const sectionRef = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();

      mm.add('(prefers-reduced-motion: no-preference)', () => {
        gsap.from('.cta-content', {
          scale: 0.95,
          opacity: 0,
          duration: 0.8,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: '.cta-content',
            start: 'top 85%',
          },
        });
      });
    },
    { scope: sectionRef }
  );

  return (
    <section
      ref={sectionRef}
      aria-labelledby="cta-title"
      className="bg-primary py-14 md:py-20"
    >
      <div className="cta-content content-container px-6 text-center">
        <h2
          id="cta-title"
          className="text-3xl font-bold tracking-tight text-white sm:text-4xl"
        >
          Envie de commander ?
        </h2>

        <p className="mx-auto mt-4 max-w-xl text-base text-white/80 sm:text-lg">
          Passez votre commande directement sur WhatsApp, on s&apos;occupe du
          reste.
        </p>

        <div className="mt-8">
          <Button
            as={Link}
            href="https://wa.me/2250700000000"
            target="_blank"
            rel="noopener noreferrer"
            color="secondary"
            size="lg"
            radius="full"
            className="px-8"
            startContent={
              <MessageCircle aria-hidden="true" className="h-5 w-5" />
            }
          >
            Commander sur WhatsApp
          </Button>
        </div>
      </div>
    </section>
  );
}

export default ContactCtaSection;
