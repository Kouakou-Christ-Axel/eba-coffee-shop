'use client';

import Image from 'next/image';
import { motion, useReducedMotion } from 'framer-motion';

function AboutHeroSection() {
  const reduceMotion = useReducedMotion();

  return (
    <section
      aria-labelledby="about-hero-title"
      className="relative flex min-h-svh items-center justify-center overflow-hidden"
    >
      <motion.div
        aria-hidden="true"
        className="absolute inset-0"
        initial={reduceMotion ? undefined : { scale: 1.08 }}
        animate={reduceMotion ? undefined : { scale: 1 }}
        transition={
          reduceMotion ? undefined : { duration: 1.6, ease: [0.22, 1, 0.36, 1] }
        }
      >
        <Image
          src="/assets/examples/accueil/eba-hero.webp"
          alt="Ambiance immersive du coffee shop EBA a Abidjan"
          fill
          priority
          className="object-cover"
          sizes="100vw"
        />
      </motion.div>

      <div className="absolute inset-0 bg-black/40" aria-hidden="true" />

      <motion.div
        className="relative z-10 px-6 text-center text-white"
        initial={reduceMotion ? undefined : { opacity: 0, y: 26 }}
        animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
        transition={
          reduceMotion
            ? undefined
            : { duration: 0.9, delay: 0.15, ease: [0.22, 1, 0.36, 1] }
        }
      >
        <div className="mx-auto max-w-3xl">
          <h1
            id="about-hero-title"
            className="text-balance text-4xl font-semibold leading-tight sm:text-5xl md:text-6xl"
          >
            Une autre vision de la p&acirc;tisserie a Abidjan
          </h1>

          <p className="mx-auto mt-5 max-w-2xl text-pretty text-base text-white/90 sm:text-lg">
            Chez EBA, chaque creation marie elegance, chaleur et savoir-faire
            pour faire de chaque pause un moment qui compte.
          </p>
        </div>
      </motion.div>
    </section>
  );
}

export default AboutHeroSection;
