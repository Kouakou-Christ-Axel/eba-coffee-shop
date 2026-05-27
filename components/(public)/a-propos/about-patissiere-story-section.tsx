'use client';

// NOTE — animations conservées en GSAP brut (pas migrées vers
// `useScrollAnimation`). Mélange parallax scrub + timeline-line scrub +
// triggers mixtes pointant sur des refs distinctes + 2 branches matchMedia
// (lg+ vs mobile) avec autoAlpha asymétrique sur le premier bloc mobile —
// l'abstraction n'apporte rien ici, le boilerplate de toute façon nécessaire.

import { useRef } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import PatissiereImageColumn from './_components/patissiere-image-column';
import TimelineLine from './_components/timeline-line';
import StoryBlock from './_components/story-block';
import { storyBlocks } from './_components/story-blocks';

gsap.registerPlugin(ScrollTrigger);

function AboutPatissiereStorySection() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const imageColumnRef = useRef<HTMLDivElement | null>(null);
  const timelineRef = useRef<HTMLDivElement | null>(null);

  useGSAP(
    () => {
      const sectionElement = sectionRef.current;
      if (!sectionElement) return;

      const blocks = gsap.utils.toArray<HTMLElement>(
        '[data-story-block]',
        sectionElement
      );
      const decorLines = gsap.utils.toArray<HTMLElement>(
        '[data-decor-line]',
        sectionElement
      );
      const heading = sectionElement.querySelector('[data-heading]');
      const subtitle = sectionElement.querySelector('[data-subtitle]');
      const signature = sectionElement.querySelector('[data-signature]');
      const timelineLine = sectionElement.querySelector('[data-timeline-line]');
      const credentialCard = sectionElement.querySelector(
        '[data-credential-card]'
      );
      const detailImage = sectionElement.querySelector('[data-detail-image]');
      const statItems = gsap.utils.toArray<HTMLElement>(
        '[data-stat-item]',
        sectionElement
      );
      const mainImage = sectionElement.querySelector('[data-main-image]');

      const mm = gsap.matchMedia();

      mm.add('(prefers-reduced-motion: reduce)', () => {
        gsap.set(
          [
            blocks,
            heading,
            subtitle,
            signature,
            credentialCard,
            detailImage,
            statItems,
          ],
          { autoAlpha: 1, y: 0 }
        );
        if (timelineLine) gsap.set(timelineLine, { scaleY: 1 });
        decorLines.forEach((line) => gsap.set(line, { scaleX: 1 }));
      });

      mm.add(
        '(min-width: 1024px) and (prefers-reduced-motion: no-preference)',
        () => {
          if (!imageColumnRef.current) return;

          if (mainImage) {
            gsap.fromTo(
              mainImage,
              { yPercent: -4 },
              {
                yPercent: 4,
                ease: 'none',
                scrollTrigger: {
                  trigger: sectionElement,
                  start: 'top bottom',
                  end: 'bottom top',
                  scrub: 0.8,
                },
              }
            );
          }

          if (credentialCard) {
            gsap.fromTo(
              credentialCard,
              { autoAlpha: 0, y: 40 },
              {
                autoAlpha: 1,
                y: 0,
                duration: 1,
                delay: 0.3,
                ease: 'power3.out',
                scrollTrigger: {
                  trigger: imageColumnRef.current,
                  start: 'top 70%',
                  toggleActions: 'play none none reverse',
                },
              }
            );
          }

          if (detailImage) {
            gsap.fromTo(
              detailImage,
              { autoAlpha: 0, x: 30, scale: 0.92 },
              {
                autoAlpha: 1,
                x: 0,
                scale: 1,
                duration: 0.9,
                delay: 0.5,
                ease: 'power3.out',
                scrollTrigger: {
                  trigger: imageColumnRef.current,
                  start: 'top 70%',
                  toggleActions: 'play none none reverse',
                },
              }
            );
          }

          if (statItems.length) {
            statItems.forEach((stat, i) => {
              gsap.fromTo(
                stat,
                { autoAlpha: 0, y: 12 },
                {
                  autoAlpha: 1,
                  y: 0,
                  duration: 0.5,
                  delay: 0.6 + i * 0.12,
                  ease: 'power2.out',
                  scrollTrigger: {
                    trigger: imageColumnRef.current,
                    start: 'top 70%',
                    toggleActions: 'play none none reverse',
                  },
                }
              );
            });
          }

          if (heading) {
            gsap.fromTo(
              heading,
              { autoAlpha: 0, y: 30 },
              {
                autoAlpha: 1,
                y: 0,
                duration: 0.9,
                ease: 'power3.out',
                scrollTrigger: {
                  trigger: heading,
                  start: 'top 85%',
                  toggleActions: 'play none none reverse',
                },
              }
            );
          }

          if (subtitle) {
            gsap.fromTo(
              subtitle,
              { autoAlpha: 0, y: 20 },
              {
                autoAlpha: 1,
                y: 0,
                duration: 0.8,
                delay: 0.15,
                ease: 'power3.out',
                scrollTrigger: {
                  trigger: subtitle,
                  start: 'top 88%',
                  toggleActions: 'play none none reverse',
                },
              }
            );
          }

          if (timelineLine) {
            gsap.fromTo(
              timelineLine,
              { scaleY: 0 },
              {
                scaleY: 1,
                ease: 'none',
                scrollTrigger: {
                  trigger: timelineRef.current,
                  start: 'top 75%',
                  end: 'bottom 60%',
                  scrub: 0.5,
                },
              }
            );
          }

          blocks.forEach((block, i) => {
            gsap.fromTo(
              block,
              { autoAlpha: 0, y: 32, x: 16 },
              {
                autoAlpha: 1,
                y: 0,
                x: 0,
                duration: 0.8,
                ease: 'power2.out',
                scrollTrigger: {
                  trigger: block,
                  start: 'top 82%',
                  toggleActions: 'play none none reverse',
                },
              }
            );

            if (decorLines[i]) {
              gsap.fromTo(
                decorLines[i],
                { scaleX: 0 },
                {
                  scaleX: 1,
                  duration: 0.6,
                  delay: 0.3,
                  ease: 'power2.inOut',
                  scrollTrigger: {
                    trigger: block,
                    start: 'top 78%',
                    toggleActions: 'play none none reverse',
                  },
                }
              );
            }
          });

          if (signature) {
            gsap.fromTo(
              signature,
              { autoAlpha: 0, y: 16 },
              {
                autoAlpha: 1,
                y: 0,
                duration: 0.7,
                ease: 'power2.out',
                scrollTrigger: {
                  trigger: signature,
                  start: 'top 90%',
                  toggleActions: 'play none none reverse',
                },
              }
            );
          }
        }
      );

      mm.add(
        '(max-width: 1023px) and (prefers-reduced-motion: no-preference)',
        () => {
          if (credentialCard) {
            gsap.fromTo(
              credentialCard,
              { autoAlpha: 0, y: 24 },
              {
                autoAlpha: 1,
                y: 0,
                duration: 0.7,
                ease: 'power2.out',
                scrollTrigger: {
                  trigger: credentialCard,
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
                duration: 0.7,
                ease: 'power2.out',
                scrollTrigger: {
                  trigger: heading,
                  start: 'top 88%',
                  toggleActions: 'play none none reverse',
                },
              }
            );
          }

          if (timelineLine) {
            gsap.fromTo(
              timelineLine,
              { scaleY: 0 },
              {
                scaleY: 1,
                ease: 'none',
                scrollTrigger: {
                  trigger: timelineRef.current,
                  start: 'top 80%',
                  end: 'bottom 50%',
                  scrub: 0.5,
                },
              }
            );
          }

          blocks.forEach((block, i) => {
            gsap.fromTo(
              block,
              { autoAlpha: i === 0 ? 1 : 0, y: i === 0 ? 0 : 24 },
              {
                autoAlpha: 1,
                y: 0,
                duration: 0.6,
                ease: 'power2.out',
                scrollTrigger: {
                  trigger: block,
                  start: 'top 88%',
                  toggleActions: 'play none none reverse',
                },
              }
            );
          });
        }
      );

      return () => {
        mm.revert();
      };
    },
    { scope: sectionRef }
  );

  return (
    <section
      ref={sectionRef}
      aria-labelledby="story-title"
      className="relative bg-[linear-gradient(180deg,rgba(255,252,248,1)_0%,rgba(247,239,232,1)_100%)] py-16 md:py-24"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E\")",
          backgroundRepeat: 'repeat',
          backgroundSize: '200px',
        }}
      />

      <div className="content-container relative">
        <div className="grid items-start gap-10 lg:grid-cols-12 lg:items-stretch lg:gap-14">
          <div className="lg:col-span-5">
            <PatissiereImageColumn ref={imageColumnRef} />
          </div>

          <div className="lg:col-span-7 lg:pt-4">
            <p
              data-subtitle
              className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-secondary-600"
            >
              <span
                aria-hidden="true"
                className="inline-block h-px w-6 bg-secondary-400"
              />
              Son parcours
            </p>

            <h2
              id="story-title"
              data-heading
              className="mt-4 max-w-xl text-3xl font-semibold leading-snug tracking-tight text-foreground sm:text-4xl lg:text-[2.6rem]"
            >
              De la France à Abidjan,
              <br />
              <span className="text-primary">une histoire de passion</span>
            </h2>

            <TimelineLine ref={timelineRef}>
              {storyBlocks.map((block, index) => (
                <StoryBlock
                  key={block.year}
                  block={block}
                  showDecorLine={index < storyBlocks.length - 1}
                />
              ))}
            </TimelineLine>

            <div
              data-signature
              className="ml-12 mt-10 border-l-2 border-secondary/50 pl-5 md:ml-14 md:mt-12"
            >
              <p className="max-w-md text-sm italic leading-relaxed text-foreground/65 md:text-base">
                &laquo;&nbsp;Chaque pâtisserie est une lettre d&apos;amour
                adressée à ceux qui prennent le temps de savourer.&nbsp;&raquo;
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default AboutPatissiereStorySection;
