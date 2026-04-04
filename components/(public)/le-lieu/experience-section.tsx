'use client';

import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Card, CardBody } from '@heroui/react';
import { Heart, Sparkles, Users, type LucideIcon } from 'lucide-react';

type ExperienceItem = {
  title: string;
  description: string;
  Icon: LucideIcon;
};

const experienceItems: ExperienceItem[] = [
  {
    title: 'Chaleureux',
    description:
      'Un lieu pense pour les rendez-vous doux, les pauses cafe et les moments simples.',
    Icon: Heart,
  },
  {
    title: 'Soigne',
    description:
      'Une attention portee aux details, a la presentation et au confort.',
    Icon: Sparkles,
  },
  {
    title: 'Convivial',
    description: 'Un espace accueillant ou l on se sent vite a sa place.',
    Icon: Users,
  },
];

function ExperienceSection() {
  const prefersReducedMotion = useReducedMotion();

  const introMotion = prefersReducedMotion
    ? {}
    : {
        initial: { opacity: 0, y: 18 },
        whileInView: { opacity: 1, y: 0 },
        viewport: { once: true, amount: 0.4 },
        transition: { duration: 0.6, ease: 'easeOut' as const },
      };

  return (
    <section
      aria-labelledby="experience-title"
      className="bg-[linear-gradient(180deg,rgba(252,249,245,1)_0%,rgba(248,243,238,1)_100%)] py-14 md:py-18"
    >
      <div className="content-container">
        <div className="mb-8 flex flex-col gap-3 md:mb-10">
          <motion.p
            className="text-xs font-semibold uppercase tracking-[0.18em] text-primary"
            {...introMotion}
          >
            Le lieu EBA
          </motion.p>
          <motion.h2
            id="experience-title"
            className="text-3xl font-bold tracking-tight sm:text-4xl"
            {...introMotion}
            transition={
              prefersReducedMotion
                ? undefined
                : { duration: 0.6, ease: 'easeOut', delay: 0.06 }
            }
          >
            L&apos;experience sur place
          </motion.h2>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-3 md:gap-6">
          {experienceItems.map((item, index) => (
            <motion.div
              key={item.title}
              initial={prefersReducedMotion ? undefined : { opacity: 0, y: 16 }}
              whileInView={
                prefersReducedMotion ? undefined : { opacity: 1, y: 0 }
              }
              viewport={{ once: true, amount: 0.35 }}
              transition={
                prefersReducedMotion
                  ? undefined
                  : { duration: 0.45, ease: 'easeOut', delay: index * 0.08 }
              }
            >
              <Card className="group h-full rounded-3xl border border-border/70 bg-white/80 shadow-sm backdrop-blur-xs transition duration-300 md:hover:-translate-y-0.5 md:hover:shadow-xl">
                <CardBody className="px-6 py-6 md:px-7 md:py-7">
                  <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <item.Icon aria-hidden="true" className="h-5 w-5" />
                  </div>

                  <h3 className="mt-5 text-xl font-semibold text-foreground">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-foreground/75 md:text-[0.95rem]">
                    {item.description}
                  </p>
                </CardBody>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default ExperienceSection;
