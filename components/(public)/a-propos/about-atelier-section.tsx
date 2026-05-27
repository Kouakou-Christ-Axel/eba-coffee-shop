'use client';

import { useRef } from 'react';
import Image from 'next/image';
import { useScrollAnimation } from '@/lib/animations/use-scroll-animation';

const atelierImages = [
  {
    src: '/assets/examples/accueil/eba-hero-2.png',
    alt: 'Préparation de la pâte dans l’atelier EBA',
    caption: 'La préparation',
  },
  {
    src: '/assets/examples/accueil/eba-hero.webp',
    alt: 'Dressage d’une création pâtissière EBA',
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

  useScrollAnimation(sectionRef, [
    {
      selector: '[data-subtitle]',
      from: { autoAlpha: 0, y: 16 },
      to: { autoAlpha: 1, y: 0, duration: 0.7, ease: 'power2.out' },
      start: 'top 88%',
    },
    {
      selector: '[data-heading]',
      from: { autoAlpha: 0, y: 24 },
      to: { autoAlpha: 1, y: 0, duration: 0.85, ease: 'power3.out' },
      delay: 0.08,
      start: 'top 86%',
    },
    {
      selector: '[data-gallery-item]',
      from: { autoAlpha: 0, y: 24, scale: 0.97 },
      to: { autoAlpha: 1, y: 0, scale: 1, duration: 0.7, ease: 'power2.out' },
      trigger: '[data-gallery]',
      start: 'top 82%',
      stagger: 0.08,
    },
  ]);

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
        data-gallery
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
