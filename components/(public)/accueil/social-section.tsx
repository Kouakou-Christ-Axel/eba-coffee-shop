'use client';

import { Link } from '@heroui/react';
import { motion, useReducedMotion } from 'framer-motion';
import type { ContactSettings } from '@/lib/contact-settings';
import SocialGallery from './_components/social-gallery';

function SocialSection({ contact }: { contact: ContactSettings }) {
  const reduceMotion = useReducedMotion();

  return (
    <section
      className="bg-muted/25 py-14 md:py-20"
      aria-labelledby="social-section-title"
    >
      <div className="content-container px-6">
        <motion.div
          className="mx-auto max-w-3xl text-center"
          initial={reduceMotion ? undefined : { opacity: 0, y: 20 }}
          whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={
            reduceMotion ? undefined : { duration: 0.65, ease: 'easeOut' }
          }
        >
          <h2
            id="social-section-title"
            className="text-3xl font-bold tracking-tight sm:text-4xl"
          >
            Suivez l&apos;aventure
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-foreground/80 sm:text-base">
            Retrouvez nos creations, l&apos;ambiance du lieu et les coulisses
            d&apos;EBA sur Instagram et TikTok a Abidjan.
          </p>

          <div className="mt-5 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm font-medium">
            <Link
              isExternal
              href={contact.instagramUrl}
              className="text-primary hover:opacity-80"
            >
              {contact.instagramHandle} on Instagram
            </Link>
            <Link
              isExternal
              href={contact.tiktokUrl}
              className="text-primary hover:opacity-80"
            >
              {contact.tiktokHandle} on TikTok
            </Link>
          </div>
        </motion.div>

        <SocialGallery reduceMotion={reduceMotion} contact={contact} />

        <motion.p
          className="mt-7 text-center text-sm text-primary md:mt-8"
          initial={reduceMotion ? undefined : { opacity: 0, y: 12 }}
          whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.6 }}
          transition={
            reduceMotion
              ? undefined
              : { duration: 0.55, ease: 'easeOut', delay: 0.2 }
          }
        >
          <Link
            isExternal
            href={contact.hashtagUrl}
            className="font-medium hover:opacity-80"
          >
            Taggez vos moments avec {contact.hashtagLabel}
          </Link>
        </motion.p>
      </div>
    </section>
  );
}

export default SocialSection;
