'use client';

import { useRef } from 'react';
import Image from 'next/image';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const atelierImages = [
  {
    src: '/assets/examples/accueil/eba-hero-2.png',
    alt: 'Préparation de la pâte dans l\u2019atelier EBA',
    caption: 'La préparation',
  },
  {
    src: '/assets/examples/accueil/eba-hero.webp',
    alt: 'Dressage d\u2019une création pâtissière EBA',
    caption: 'Le dressage',
  },
  {
    src: '/assets/examples/accueil/eba-hero-2.png',
    alt: 'Sélection des ingrédients frais du marché',
    caption: 'Les ingrédients',
  },
  {
    src: '/assets/examples/accueil/eba-hero.webp',
    alt: 'Le résultat final prêt à être servi',
    caption: 'Le résultat',
  },
];

function AboutAtelierSection() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  useGSAP(
    () => {
      const section = sectionRef.current;
      if (!section) return;

      const heading = section.querySelector('[data-heading]');
      const subtitle = section.querySelector('[data-subtitle]');
      const images = gsap.utils.toArray<HTMLElement>(
        '[data-gallery-item]',
        section
      );

      const mm = gsap.matchMedia();

      mm.add('(prefers-reduced-motion: reduce)', () => {
        gsap.set([heading, subtitle, ...images], { autoAlpha: 1, y: 0 });
      });

      mm.add('(prefers-reduced-motion: no-preference)', () => {
        if (subtitle) {
          gsap.fromTo(
            subtitle,
            { autoAlpha: 0, y: 16 },
            {
              autoAlpha: 1,
              y: 0,
              duration: 0.7,
              ease: 'power2.out',
              scrollTrigger: {
                trigger: subtitle,
                start: 'top 88%',
                toggleActions: 'play none none reverse',
              },
            }
          );
        }

        if (heading) {
          gsap.fromTo(
            heading,
            { autoAlpha: 0, y: 24 },
            {
              autoAlpha: 1,
              y: 0,
              duration: 0.85,
              delay: 0.08,
              ease: 'power3.out',
              scrollTrigger: {
                trigger: heading,
                start: 'top 86%',
                toggleActions: 'play none none reverse',
              },
            }
          );
        }

        images.forEach((img, i) => {
          gsap.fromTo(
            img,
            { autoAlpha: 0, y: 24, scale: 0.97 },
            {
              autoAlpha: 1,
              y: 0,
              scale: 1,
              duration: 0.7,
              delay: i * 0.08,
              ease: 'power2.out',
              scrollTrigger: {
                trigger: scrollContainerRef.current,
                start: 'top 82%',
                toggleActions: 'play none none reverse',
              },
            }
          );
        });
      });

      return () => {
        mm.revert();
      };
    },
    { scope: sectionRef }
  );

  return (
    <section
      ref={sectionRef}
      aria-labelledby="atelier-title"
      className="bg-[linear-gradient(180deg,rgba(247,239,232,1)_0%,rgba(255,252,248,1)_100%)] py-14 md:py-20"
    >
      {/* Header — left aligned in container */}
      <div className="content-container">
        <p
          data-subtitle
          className="inline-flex items-center gap-2.5 text-xs font-semibold uppercase tracking-[0.2em] text-secondary-600"
        >
          <span
            aria-hidden="true"
            className="inline-block h-px w-5 bg-secondary/40"
          />
          En coulisses
        </p>

        <h2
          id="atelier-title"
          data-heading
          className="mt-4 max-w-lg text-3xl font-semibold leading-snug tracking-tight sm:text-4xl"
        >
          Du geste à l&apos;assiette
        </h2>
      </div>

      {/* Horizontal scroll gallery */}
      <div
        ref={scrollContainerRef}
        className="content-container mt-10 flex snap-x snap-mandatory gap-4 overflow-x-auto pb-4 md:mt-12 md:gap-5"
        style={{ scrollbarWidth: 'none' }}
      >
        {atelierImages.map((image, index) => (
          <figure
            key={index}
            data-gallery-item
            className="w-72 shrink-0 snap-start sm:w-80 md:w-96"
          >
            <div className="relative aspect-3/4 overflow-hidden rounded-2xl bg-foreground/5 lg:rounded-3xl">
              <Image
                src={image.src}
                alt={image.alt}
                fill
                sizes="(max-width: 640px) 288px, (max-width: 768px) 320px, 384px"
                className="object-cover object-center transition-transform duration-500 hover:scale-105"
              />
              <div
                aria-hidden="true"
                className="absolute inset-0 bg-linear-to-t from-black/25 via-transparent to-transparent"
              />
            </div>
            <figcaption className="mt-3 text-sm font-medium text-foreground/50">
              {image.caption}
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}

export default AboutAtelierSection;
