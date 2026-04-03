'use client';

import Image from 'next/image';
import { motion, useReducedMotion } from 'framer-motion';

function AboutVisionSection() {
  const reduceMotion = useReducedMotion();

  const textGroup = reduceMotion
    ? undefined
    : {
        hidden: { opacity: 0, y: 18 },
        visible: {
          opacity: 1,
          y: 0,
          transition: {
            duration: 0.7,
            ease: [0.22, 1, 0.36, 1],
            staggerChildren: 0.1,
          },
        },
      };

  const textItem = reduceMotion
    ? undefined
    : {
        hidden: { opacity: 0, y: 14 },
        visible: {
          opacity: 1,
          y: 0,
          transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] },
        },
      };

  return (
    <section
      aria-labelledby="about-vision-title"
      className="bg-[linear-gradient(180deg,rgba(255,251,247,1)_0%,rgba(250,245,241,1)_100%)] py-20 md:py-28"
    >
      <div className="content-container">
        <div className="grid items-center gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14">
          <motion.div
            variants={textGroup}
            initial={reduceMotion ? undefined : 'hidden'}
            whileInView={reduceMotion ? undefined : 'visible'}
            viewport={{ once: true, amount: 0.35 }}
            className="max-w-2xl"
          >
            <motion.h2
              id="about-vision-title"
              variants={textItem}
              className="text-3xl font-semibold tracking-tight sm:text-4xl"
            >
              Notre vision
            </motion.h2>

            <motion.p
              variants={textItem}
              className="mt-5 text-base leading-relaxed text-foreground/80 sm:text-lg"
            >
              EBA imagine un lieu ou cafe, patisserie et hospitalite se
              rencontrent pour offrir a Abidjan une experience quotidienne plus
              belle, plus chaleureuse et plus inspiree.
            </motion.p>
          </motion.div>

          <motion.figure
            initial={reduceMotion ? undefined : { opacity: 0, y: 22 }}
            whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.25 }}
            transition={
              reduceMotion
                ? undefined
                : { duration: 0.75, delay: 0.08, ease: [0.22, 1, 0.36, 1] }
            }
            className="overflow-hidden rounded-3xl border border-default-200/70 bg-content1 shadow-lg"
          >
            <div className="relative h-72 w-full sm:h-80 md:h-96 lg:h-[30rem]">
              <Image
                src="/assets/examples/accueil/eba-hero-2.png"
                alt="Interieur raffine du coffee shop EBA a Abidjan"
                fill
                sizes="(max-width: 1024px) 100vw, 45vw"
                className="object-cover"
              />
            </div>
          </motion.figure>
        </div>
      </div>
    </section>
  );
}

export default AboutVisionSection;
