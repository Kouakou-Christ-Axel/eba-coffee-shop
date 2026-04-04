'use client';

import Image from 'next/image';
import { motion, useReducedMotion } from 'framer-motion';

function AboutHeroSection() {
  const reduceMotion = useReducedMotion();

  return (
    <section
      aria-labelledby="about-hero-title"
      className="relative min-h-svh w-full overflow-hidden"
    >
      <Image
        src="/assets/examples/accueil/eba-hero-2.png"
        alt="Intérieur du coffee shop EBA — pâtisserie artisanale à Cocody, Abidjan"
        fill
        priority
        sizes="100vw"
        className="object-cover object-center"
      />

      <div aria-hidden="true" className="absolute inset-0 bg-black/55" />
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-linear-to-t from-black/35 via-black/15 to-transparent"
      />

      <motion.div
        className="relative z-10 flex min-h-svh items-center justify-center px-6"
        initial={reduceMotion ? undefined : { opacity: 0, y: 20 }}
        animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
        transition={
          reduceMotion
            ? undefined
            : { duration: 0.8, delay: 0.08, ease: [0.22, 1, 0.36, 1] }
        }
      >
        <div className="mx-auto flex w-full max-w-4xl flex-col items-center gap-4 text-center text-white">
          <span className="rounded-full border border-white/40 bg-white/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.2em]">
            A propos
          </span>

          <h1
            id="about-hero-title"
            className="text-balance text-4xl font-semibold leading-tight sm:text-5xl md:text-6xl"
          >
            L&apos;histoire d&apos;EBA — pâtisserie artisanale à Abidjan
          </h1>

          <p className="max-w-2xl text-pretty text-base text-white/90 sm:text-lg">
            Chez EBA, nous croyons à la douceur des pauses bien faites&nbsp;: un
            café, une pâtisserie, une ambiance soignée et le plaisir de prendre
            son temps.
          </p>
        </div>
      </motion.div>
    </section>
  );
}

export default AboutHeroSection;
