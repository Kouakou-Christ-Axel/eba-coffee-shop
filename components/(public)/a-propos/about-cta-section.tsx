'use client';

import { useRef } from 'react';
import Link from 'next/link';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

function AboutCtaSection() {
  const sectionRef = useRef<HTMLElement | null>(null);

  useGSAP(
    () => {
      const section = sectionRef.current;
      if (!section) return;

      const content = section.querySelector('[data-content]');
      const buttons = gsap.utils.toArray<HTMLElement>(
        '[data-cta-btn]',
        section
      );

      const mm = gsap.matchMedia();

      mm.add('(prefers-reduced-motion: reduce)', () => {
        gsap.set([content, ...buttons], { autoAlpha: 1, y: 0 });
      });

      mm.add('(prefers-reduced-motion: no-preference)', () => {
        if (content) {
          gsap.fromTo(
            content,
            { autoAlpha: 0, y: 24 },
            {
              autoAlpha: 1,
              y: 0,
              duration: 0.85,
              ease: 'power3.out',
              scrollTrigger: {
                trigger: content,
                start: 'top 82%',
                toggleActions: 'play none none reverse',
              },
            }
          );
        }

        buttons.forEach((btn, i) => {
          gsap.fromTo(
            btn,
            { autoAlpha: 0, y: 14 },
            {
              autoAlpha: 1,
              y: 0,
              duration: 0.6,
              delay: 0.25 + i * 0.1,
              ease: 'power2.out',
              scrollTrigger: {
                trigger: content,
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
      aria-label="Invitation à découvrir EBA"
      className="bg-[linear-gradient(180deg,rgba(255,252,248,1)_0%,rgba(247,239,232,1)_100%)] py-14 md:py-20"
    >
      <div className="content-container">
        <div className="mx-auto max-w-xl text-center">
          <div data-content>
            <p className="text-sm font-medium text-foreground/40">
              On a hâte de vous accueillir.
            </p>
            <h2 className="mt-3 text-balance text-2xl font-semibold leading-snug tracking-tight sm:text-3xl lg:text-4xl">
              Venez voir par vous-même
            </h2>
            <p className="mt-4 text-base leading-relaxed text-foreground/55">
              Poussez la porte, installez-vous, et laissez-vous surprendre.
            </p>
          </div>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
            <Link
              href="/le-lieu"
              data-cta-btn
              className="inline-flex h-11 items-center justify-center rounded-xl bg-primary px-7 text-sm font-semibold text-primary-foreground transition-colors duration-200 hover:bg-primary-700"
            >
              Découvrir le lieu
            </Link>
            <Link
              href="/contact"
              data-cta-btn
              className="inline-flex h-11 items-center justify-center rounded-xl border border-foreground/10 bg-white/60 px-7 text-sm font-semibold text-foreground/70 backdrop-blur-sm transition-colors duration-200 hover:border-foreground/15 hover:bg-white/80"
            >
              Nous contacter
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

export default AboutCtaSection;
