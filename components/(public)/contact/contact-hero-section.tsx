'use client';

import Image from 'next/image';
import React, { useRef } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { SplitText } from 'gsap/SplitText';

gsap.registerPlugin(useGSAP, SplitText);

function ContactHeroSection() {
  const sectionRef = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();

      mm.add('(prefers-reduced-motion: no-preference)', () => {
        gsap.from('.contact-hero-image', {
          scale: 1.08,
          duration: 1.6,
          ease: 'power2.out',
        });

        SplitText.create('.contact-hero-title', {
          type: 'words',
          autoSplit: true,
          onSplit(self) {
            return gsap.from(self.words, {
              opacity: 0,
              y: 30,
              stagger: 0.08,
              duration: 0.6,
              ease: 'power3.out',
              delay: 0.3,
            });
          },
        });

        gsap.from('.contact-hero-subtitle', {
          opacity: 0,
          y: 20,
          duration: 0.8,
          ease: 'power2.out',
          delay: 0.8,
        });
      });
    },
    { scope: sectionRef }
  );

  return (
    <section
      ref={sectionRef}
      aria-labelledby="contact-hero-title"
      className="relative flex min-h-svh items-center justify-center overflow-hidden"
    >
      <div className="contact-hero-image absolute inset-0" aria-hidden="true">
        <Image
          src="/assets/examples/accueil/eba-hero.webp"
          alt="Ambiance chaleureuse du coffee shop EBA a Abidjan"
          fill
          priority
          className="object-cover"
          sizes="100vw"
        />
      </div>

      <div className="absolute inset-0 bg-black/50" aria-hidden="true" />

      <div className="relative z-10 px-6 text-center text-white">
        <div className="mx-auto max-w-3xl">
          <h1
            id="contact-hero-title"
            className="contact-hero-title text-balance text-4xl font-semibold leading-tight sm:text-5xl md:text-6xl"
          >
            Parlons autour d&apos;un cafe
          </h1>

          <p className="contact-hero-subtitle mx-auto mt-5 max-w-2xl text-pretty text-base text-white/90 sm:text-lg">
            Une question, une reservation ou un projet ? On vous repond avec
            plaisir.
          </p>
        </div>
      </div>
    </section>
  );
}

export default ContactHeroSection;
