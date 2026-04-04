'use client';

import Image from 'next/image';
import React from 'react';
import { Link } from '@heroui/react';
import { motion, useReducedMotion } from 'framer-motion';
import { Instagram, Music2, Play } from 'lucide-react';
import { brandConfig } from '@/config/brand.config';

type SocialItem = {
  title: string;
  platform: 'Instagram' | 'TikTok';
  type: 'image' | 'video';
  href: string;
  imageSrc: string;
  imageAlt: string;
};

const instagramLink = brandConfig.links.social.instagram.href;
const tiktokLink = brandConfig.links.social.tiktok.href;

const socialItems: SocialItem[] = [
  {
    title: 'Latte art du matin',
    platform: 'Instagram',
    type: 'image',
    href: instagramLink,
    imageSrc: '/assets/examples/accueil/eba-hero-2.png',
    imageAlt: 'Cafe signature servi sur un comptoir elegant a Abidjan',
  },
  {
    title: 'Backstage patisserie',
    platform: 'TikTok',
    type: 'video',
    href: tiktokLink,
    imageSrc: '/assets/examples/accueil/eba-hero.webp',
    imageAlt: 'Preparation de patisserie artisanale dans l ambiance EBA',
  },
  {
    title: 'Ambiance du lieu',
    platform: 'Instagram',
    type: 'image',
    href: instagramLink,
    imageSrc: '/assets/examples/accueil/eba-hero.webp',
    imageAlt: 'Ambiance chaleureuse du coffee shop EBA a Abidjan',
  },
  {
    title: 'Routine barista',
    platform: 'TikTok',
    type: 'video',
    href: tiktokLink,
    imageSrc: '/assets/examples/accueil/eba-hero-2.png',
    imageAlt: 'Barista en preparation de cafe dans un decor premium',
  },
  {
    title: 'Pause gourmande',
    platform: 'Instagram',
    type: 'image',
    href: instagramLink,
    imageSrc: '/assets/examples/accueil/eba-hero-2.png',
    imageAlt: 'Patisserie et cafe servis en salle dans le quartier Cocody',
  },
  {
    title: 'Vibes du soir',
    platform: 'TikTok',
    type: 'video',
    href: tiktokLink,
    imageSrc: '/assets/examples/accueil/eba-hero.webp',
    imageAlt: 'Scene video de l ambiance du lieu EBA en fin de journee',
  },
];

function SocialSection() {
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
              href={brandConfig.links.social.instagram.href}
              className="text-primary hover:opacity-80"
            >
              {brandConfig.links.social.instagram.handle} on Instagram
            </Link>
            <Link
              isExternal
              href={brandConfig.links.social.tiktok.href}
              className="text-primary hover:opacity-80"
            >
              {brandConfig.links.social.tiktok.handle} on TikTok
            </Link>
          </div>
        </motion.div>

        <ul
          className="mt-8 grid grid-cols-2 gap-4 md:mt-10 md:grid-cols-3 md:gap-5"
          role="list"
        >
          {socialItems.map((item, index) => {
            const isInstagram = item.platform === 'Instagram';
            const PlatformIcon = isInstagram ? Instagram : Music2;

            return (
              <motion.li
                key={`${item.title}-${index}`}
                initial={reduceMotion ? undefined : { opacity: 0, y: 16 }}
                whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.25 }}
                transition={
                  reduceMotion
                    ? undefined
                    : { duration: 0.6, ease: 'easeOut', delay: index * 0.07 }
                }
              >
                <Link
                  isExternal
                  href={item.href}
                  className="group block overflow-hidden rounded-2xl border border-default-200/75 bg-content1 shadow-sm transition duration-500 md:hover:scale-[1.015] md:hover:shadow-lg"
                >
                  <figure className="relative">
                    <div className="relative aspect-4/5 w-full overflow-hidden">
                      <Image
                        src={item.imageSrc}
                        alt={item.imageAlt}
                        fill
                        sizes="(max-width: 768px) 50vw, 33vw"
                        className="object-cover transition-transform duration-500 ease-out md:group-hover:scale-[1.03]"
                      />
                    </div>

                    <figcaption className="absolute left-3 right-3 top-3 flex items-center justify-between">
                      <span className="inline-flex items-center gap-1 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur-sm">
                        <PlatformIcon
                          aria-hidden="true"
                          className="h-3.5 w-3.5"
                        />
                        {item.platform}
                      </span>
                      {item.type === 'video' && (
                        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm">
                          <Play aria-hidden="true" className="h-3.5 w-3.5" />
                        </span>
                      )}
                    </figcaption>

                    <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/65 via-black/25 to-transparent p-3">
                      <p className="text-xs font-medium text-white sm:text-sm">
                        {item.title}
                      </p>
                    </div>
                  </figure>
                </Link>
              </motion.li>
            );
          })}
        </ul>

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
            href={brandConfig.links.hashtag.href}
            className="font-medium hover:opacity-80"
          >
            Taggez vos moments avec {brandConfig.links.hashtag.label}
          </Link>
        </motion.p>
      </div>
    </section>
  );
}

export default SocialSection;
