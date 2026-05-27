'use client';

import { useRef } from 'react';
import Image from 'next/image';
import { useScrollAnimation } from '@/lib/animations/use-scroll-animation';

function AboutVisionSection() {
  const sectionRef = useRef<HTMLElement | null>(null);

  useScrollAnimation(sectionRef, [
    {
      selector: '[data-heading]',
      from: { autoAlpha: 0, y: 24 },
      to: { autoAlpha: 1, y: 0, duration: 0.85, ease: 'power3.out' },
      start: 'top 85%',
    },
    {
      selector: '[data-description]',
      from: { autoAlpha: 0, y: 18 },
      to: { autoAlpha: 1, y: 0, duration: 0.7, ease: 'power2.out' },
      delay: 0.12,
      start: 'top 88%',
    },
    {
      selector: '[data-banner]',
      from: { autoAlpha: 0, scale: 0.96 },
      to: { autoAlpha: 1, scale: 1, duration: 1, ease: 'power3.out' },
      start: 'top 82%',
    },
    {
      selector: '[data-banner] img',
      from: { yPercent: -6 },
      to: { yPercent: 6, ease: 'none' },
      trigger: '[data-banner]',
      start: 'top bottom',
      end: 'bottom top',
      scrub: 0.6,
      reducedMotion: 'skip',
    },
  ]);

  return (
    <section
      ref={sectionRef}
      aria-labelledby="about-vision-title"
      className="bg-[linear-gradient(180deg,rgba(247,239,232,1)_0%,rgba(255,252,248,1)_100%)] py-14 md:py-20"
    >
      <div className="content-container">
        <div className="mx-auto max-w-2xl text-center">
          <h2
            id="about-vision-title"
            data-heading
            className="text-balance text-3xl font-semibold leading-snug tracking-tight sm:text-4xl lg:text-[2.6rem]"
          >
            Un espace de qualité, accessible et{' '}
            <span className="text-primary">sincère</span>
          </h2>
          <p
            data-description
            className="mt-5 text-pretty text-base leading-relaxed text-foreground/60 sm:text-lg"
          >
            Chez EBA, chaque détail est pensé pour que le moment soit à la
            hauteur&nbsp;: un café bien torréfié, une pâtisserie soignée, un
            cadre qui invite à rester.
          </p>
        </div>

        <div
          data-banner
          className="mt-12 overflow-hidden rounded-3xl shadow-xl md:mt-14 lg:rounded-4xl"
        >
          <div className="relative aspect-21/9 w-full">
            <Image
              src="/assets/examples/accueil/eba-hero.webp"
              alt="L'ambiance chaleureuse et soignée du lieu EBA à Abidjan"
              fill
              sizes="100vw"
              className="scale-115 object-cover object-center"
            />
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-linear-to-t from-black/20 via-transparent to-transparent"
            />
          </div>
        </div>
      </div>
    </section>
  );
}

export default AboutVisionSection;
