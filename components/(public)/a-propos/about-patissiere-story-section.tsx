'use client';

import React, { useRef } from 'react';
import Image from 'next/image';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

type StoryBlock = {
  year: string;
  title: string;
  text: string;
};

const storyBlocks: StoryBlock[] = [
  {
    year: '01',
    title: 'Une passion née dans la cuisine',
    text: 'Depuis toujours, la pâtisserie est une manière de créer du beau, de faire plaisir et de partager des moments simples. Chaque recette raconte une histoire.',
  },
  {
    year: '02',
    title: 'L\u2019école de la rigueur en France',
    text: 'En France, elle développe le goût de la précision, de l\u2019équilibre des saveurs et du soin du détail. Une formation exigeante qui forge le savoir-faire.',
  },
  {
    year: '03',
    title: 'Le retour à Abidjan',
    text: 'De retour à Abidjan, l\u2019envie est claire\u00a0: créer un lieu chaleureux, accessible et exigeant à la fois. Un pont entre deux cultures gourmandes.',
  },
  {
    year: '04',
    title: 'EBA prend vie',
    text: 'Aujourd\u2019hui, EBA reflète cette vision\u00a0: un espace gourmand, soigné et convivial, pensé pour faire du bien. Chaque détail est une attention.',
  },
];

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

          // No pin — sticky is handled via CSS (lg:sticky lg:top-24)

          // Subtle parallax on main image
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

          // Credential card slides up from bottom
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

          // Detail image slides in from right
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

          // Stat items stagger in
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

          // Heading & subtitle stagger
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

          // Timeline line grows as you scroll
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

          // Story blocks stagger in
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

            // Decor line under each block
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

          // Signature
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
          // Credential card
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

          // Heading
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

          // Timeline line
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
      {/* Decorative background grain */}
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
          {/* Left — Image composition */}
          <div className="lg:col-span-5">
            <div
              ref={imageColumnRef}
              className="relative lg:sticky lg:top-24 lg:h-[78svh]"
            >
              {/* Main portrait image */}
              <div className="relative h-80 overflow-hidden rounded-4xl shadow-2xl sm:h-104 lg:h-[calc(100%-5rem)]">
                <Image
                  data-main-image
                  src="/assets/examples/accueil/eba-hero-2.png"
                  alt="La pâtissière d'EBA en pleine préparation dans son atelier"
                  fill
                  sizes="(max-width: 1024px) 100vw, 40vw"
                  className="scale-105 object-cover object-center"
                />
                <div
                  aria-hidden="true"
                  className="absolute inset-0 bg-linear-to-t from-black/50 via-black/10 to-transparent"
                />

                {/* Name & title overlay on image */}
                <div className="absolute bottom-0 left-0 right-0 z-10 p-5 sm:p-6">
                  <div className="flex items-center gap-3">
                    <div
                      aria-hidden="true"
                      className="h-8 w-0.5 rounded-full bg-secondary"
                    />
                    <div>
                      <p className="text-sm font-semibold tracking-wide text-white sm:text-base">
                        Fondatrice & Pâtissière
                      </p>
                      <p className="text-xs font-medium uppercase tracking-[0.15em] text-white/60">
                        EBA Coffee Shop &middot; Abidjan
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Detail image — overlapping bottom-right */}
              <div
                data-detail-image
                className="absolute -bottom-2 -right-3 z-10 h-28 w-28 overflow-hidden rounded-2xl border-3 border-background shadow-xl sm:h-36 sm:w-36 lg:-right-5 lg:h-40 lg:w-40"
              >
                <Image
                  src="/assets/examples/accueil/eba-hero.webp"
                  alt="Détail d'une création pâtissière EBA"
                  fill
                  sizes="160px"
                  className="object-cover object-center"
                />
              </div>

              {/* Credential card — floating left-bottom */}
              <div
                data-credential-card
                className="absolute -bottom-2 left-3 z-10 sm:left-4 lg:-left-3"
              >
                <div className="rounded-2xl border border-white/60 bg-white/80 px-4 py-4 shadow-lg shadow-black/5 backdrop-blur-md sm:px-5 sm:py-4.5">
                  <div className="space-y-2.5">
                    <div data-stat-item className="flex items-center gap-2.5">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/8">
                        <span className="h-1.5 w-1.5 rounded-full bg-primary/60" />
                      </span>
                      <p className="text-xs font-medium text-foreground/70 sm:text-[0.8rem]">
                        Formée en{' '}
                        <span className="text-foreground/90">France</span>
                      </p>
                    </div>

                    <div data-stat-item className="flex items-center gap-2.5">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-secondary/10">
                        <span className="h-1.5 w-1.5 rounded-full bg-secondary/60" />
                      </span>
                      <p className="text-xs font-medium text-foreground/70 sm:text-[0.8rem]">
                        CAP Pâtisserie{' '}
                        <span className="text-foreground/50">&middot;</span>{' '}
                        <span className="text-foreground/90">10+ ans</span>
                      </p>
                    </div>

                    <div data-stat-item className="flex items-center gap-2.5">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/8">
                        <span className="h-1.5 w-1.5 rounded-full bg-primary/60" />
                      </span>
                      <p className="text-xs font-medium text-foreground/70 sm:text-[0.8rem]">
                        Savoir-faire{' '}
                        <span className="text-foreground/90">artisanal</span>
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Decorative corner accents */}
              <div
                aria-hidden="true"
                className="absolute -right-2.5 -top-2.5 h-16 w-16 rounded-br-3xl border-r-2 border-t-2 border-secondary/30"
              />
              <div
                aria-hidden="true"
                className="absolute -left-2.5 top-8 h-12 w-12 rounded-tl-2xl border-l-2 border-t-2 border-primary/20"
              />
            </div>
          </div>

          {/* Right — Story */}
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

            {/* Timeline blocks */}
            <div ref={timelineRef} className="relative mt-10 md:mt-12">
              {/* Vertical timeline line */}
              <div
                aria-hidden="true"
                className="absolute bottom-0 left-4 top-0 w-px origin-top md:left-5"
              >
                <div
                  data-timeline-line
                  className="h-full w-full origin-top bg-linear-to-b from-secondary via-primary/30 to-transparent"
                />
              </div>

              <div className="space-y-6 md:space-y-8">
                {storyBlocks.map((block, index) => (
                  <article
                    key={block.year}
                    data-story-block
                    className="relative pl-12 md:pl-14"
                  >
                    {/* Timeline dot */}
                    <div
                      aria-hidden="true"
                      className="absolute left-1.5 top-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-secondary bg-background md:left-2.5 md:h-5 md:w-5"
                    >
                      <div className="h-1.5 w-1.5 rounded-full bg-secondary" />
                    </div>

                    {/* Step number */}
                    <span className="mb-2 block font-mono text-xs font-medium tracking-wider text-secondary-600/70">
                      {block.year}
                    </span>

                    <h3 className="text-lg font-semibold tracking-tight text-foreground md:text-xl">
                      {block.title}
                    </h3>

                    <p className="mt-2 max-w-lg text-sm leading-relaxed text-foreground/70 md:text-[0.95rem] md:leading-relaxed">
                      {block.text}
                    </p>

                    {/* Decorative line under text */}
                    {index < storyBlocks.length - 1 && (
                      <div
                        data-decor-line
                        aria-hidden="true"
                        className="mt-5 h-px w-16 origin-left bg-primary/15 md:mt-6"
                      />
                    )}
                  </article>
                ))}
              </div>
            </div>

            {/* Signature / closing quote */}
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
