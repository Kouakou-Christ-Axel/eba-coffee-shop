'use client';

import { useRef } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const engagements = [
  {
    title: 'Fait maison, chaque matin',
    text: 'Toutes nos pâtisseries sont préparées sur place, chaque jour. Rien de surgelé, rien de réchauffé.',
  },
  {
    title: 'Des ingrédients traçables',
    text: 'Beurre français, chocolat de couverture, fruits frais du marché. On sait d\u2019où vient ce qu\u2019on utilise.',
  },
  {
    title: 'Zéro conservateur',
    text: 'Nos recettes sont courtes et lisibles. Si vous ne reconnaissez pas un ingrédient, c\u2019est qu\u2019il n\u2019a pas sa place chez nous.',
  },
  {
    title: 'Un prix juste',
    text: 'L\u2019exigence ne doit pas être un luxe. Nous travaillons chaque recette pour qu\u2019elle reste accessible, sans compromis sur la qualité.',
  },
];

function AboutEngagementsSection() {
  const sectionRef = useRef<HTMLElement | null>(null);

  useGSAP(
    () => {
      const section = sectionRef.current;
      if (!section) return;

      const heading = section.querySelector('[data-heading]');
      const subtitle = section.querySelector('[data-subtitle]');
      const cards = gsap.utils.toArray<HTMLElement>('[data-card]', section);

      const mm = gsap.matchMedia();

      mm.add('(prefers-reduced-motion: reduce)', () => {
        gsap.set([heading, subtitle, ...cards], { autoAlpha: 1, y: 0 });
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

        cards.forEach((card, i) => {
          gsap.fromTo(
            card,
            { autoAlpha: 0, y: 28 },
            {
              autoAlpha: 1,
              y: 0,
              duration: 0.7,
              delay: i * 0.1,
              ease: 'power2.out',
              scrollTrigger: {
                trigger: card,
                start: 'top 86%',
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
      aria-labelledby="engagements-title"
      className="bg-[linear-gradient(180deg,rgba(255,252,248,1)_0%,rgba(247,239,232,1)_100%)] py-14 md:py-20"
    >
      <div className="content-container">
        {/* Header */}
        <div className="mx-auto max-w-2xl text-center">
          <p
            data-subtitle
            className="inline-flex items-center gap-2.5 text-xs font-semibold uppercase tracking-[0.2em] text-secondary-600"
          >
            <span
              aria-hidden="true"
              className="inline-block h-px w-5 bg-secondary/40"
            />
            Ce qui nous guide
            <span
              aria-hidden="true"
              className="inline-block h-px w-5 bg-secondary/40"
            />
          </p>

          <h2
            id="engagements-title"
            data-heading
            className="mt-4 text-balance text-3xl font-semibold leading-snug tracking-tight sm:text-4xl"
          >
            Nos engagements, pas des promesses
          </h2>
        </div>

        {/* Cards grid */}
        <div className="mx-auto mt-12 grid max-w-4xl gap-4 sm:grid-cols-2 md:mt-14 md:gap-5">
          {engagements.map((item, index) => (
            <article
              key={item.title}
              data-card
              className="group rounded-2xl border border-foreground/5 bg-white/60 px-6 py-6 backdrop-blur-sm transition-colors duration-300 hover:border-primary/10 hover:bg-white/80 sm:py-7"
            >
              <div className="flex items-start gap-3.5">
                <span
                  aria-hidden="true"
                  className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/8 text-[0.65rem] font-semibold text-primary/60"
                >
                  {String(index + 1).padStart(2, '0')}
                </span>
                <div>
                  <h3 className="text-[0.95rem] font-semibold tracking-tight text-foreground sm:text-base">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-foreground/55">
                    {item.text}
                  </p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export default AboutEngagementsSection;
