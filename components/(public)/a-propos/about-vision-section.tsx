'use client';

import { useRef } from 'react';
import Image from 'next/image';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

function AboutVisionSection() {
  const sectionRef = useRef<HTMLElement | null>(null);

  useGSAP(
    () => {
      const section = sectionRef.current;
      if (!section) return;

      const heading = section.querySelector('[data-heading]');
      const description = section.querySelector('[data-description]');
      const banner = section.querySelector('[data-banner]');

      const mm = gsap.matchMedia();

      mm.add('(prefers-reduced-motion: reduce)', () => {
        gsap.set([heading, description, banner], {
          autoAlpha: 1,
          y: 0,
        });
      });

      mm.add('(prefers-reduced-motion: no-preference)', () => {
        if (heading) {
          gsap.fromTo(
            heading,
            { autoAlpha: 0, y: 24 },
            {
              autoAlpha: 1,
              y: 0,
              duration: 0.85,
              ease: 'power3.out',
              scrollTrigger: {
                trigger: heading,
                start: 'top 85%',
                toggleActions: 'play none none reverse',
              },
            }
          );
        }

        if (description) {
          gsap.fromTo(
            description,
            { autoAlpha: 0, y: 18 },
            {
              autoAlpha: 1,
              y: 0,
              duration: 0.7,
              delay: 0.12,
              ease: 'power2.out',
              scrollTrigger: {
                trigger: description,
                start: 'top 88%',
                toggleActions: 'play none none reverse',
              },
            }
          );
        }

        if (banner) {
          gsap.fromTo(
            banner,
            { autoAlpha: 0, scale: 0.96 },
            {
              autoAlpha: 1,
              scale: 1,
              duration: 1,
              ease: 'power3.out',
              scrollTrigger: {
                trigger: banner,
                start: 'top 82%',
                toggleActions: 'play none none reverse',
              },
            }
          );

          const img = banner.querySelector('img');
          if (img) {
            gsap.fromTo(
              img,
              { yPercent: -6 },
              {
                yPercent: 6,
                ease: 'none',
                scrollTrigger: {
                  trigger: banner,
                  start: 'top bottom',
                  end: 'bottom top',
                  scrub: 0.6,
                },
              }
            );
          }
        }
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
