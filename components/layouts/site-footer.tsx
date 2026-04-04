'use client';

import Image from 'next/image';
import React from 'react';
import { Link } from '@heroui/react';
import { motion, useReducedMotion } from 'framer-motion';
import { Instagram, Music2, MapPin, MessageCircle, Mail } from 'lucide-react';
import { brandConfig } from '@/config/brand.config';

const socialItems = [
  {
    ...brandConfig.links.social.instagram,
    icon: Instagram,
  },
  {
    ...brandConfig.links.social.tiktok,
    icon: Music2,
  },
] as const;

function SiteFooter() {
  const reduceMotion = useReducedMotion();

  const fadeUp = reduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: 16 },
        whileInView: { opacity: 1, y: 0 },
        viewport: { once: true, amount: 0.25 },
        transition: { duration: 0.6, ease: 'easeOut' as const },
      };

  return (
    <footer className="border-t border-white/10 bg-[linear-gradient(180deg,rgba(20,20,25,1)_0%,rgba(15,15,20,1)_100%)] text-white">
      <div className="mx-auto w-full max-w-5xl px-6">
        <motion.div className="flex items-center justify-between border-b border-white/10 py-6 md:py-7">
          <Image
            src="/assets/logos/eba_white_n.png"
            alt="EBA logo"
            width={48}
            height={48}
          />
          <div className="flex items-center gap-4">
            {socialItems.map((social) => {
              const Icon = social.icon;
              return (
                <Link
                  key={social.label}
                  isExternal
                  href={social.href}
                  aria-label={`Suivez EBA sur ${social.label}`}
                  className="text-white/70 transition duration-300 hover:text-primary"
                >
                  <Icon className="h-5 w-5" />
                </Link>
              );
            })}
          </div>
        </motion.div>

        <div className="grid gap-8 py-8 md:grid-cols-3 md:py-9 lg:gap-12">
          <motion.div
            {...fadeUp}
            transition={
              reduceMotion
                ? undefined
                : { duration: 0.6, ease: 'easeOut', delay: 0.1 }
            }
          >
            <h3 className="text-sm font-bold uppercase tracking-wide text-white">
              {brandConfig.name}
            </h3>
            <p className="mt-3 text-sm text-white/75 leading-relaxed">
              Café et pâtisserie artisanale à Cocody, Abidjan. Votre coffee shop
              pour savourer l&apos;instant.
            </p>
          </motion.div>

          <motion.div
            {...fadeUp}
            transition={
              reduceMotion
                ? undefined
                : { duration: 0.6, ease: 'easeOut', delay: 0.15 }
            }
          >
            <h3 className="text-sm font-bold uppercase tracking-wide text-white">
              Navigation
            </h3>
            <ul className="mt-4 space-y-2" role="list">
              {brandConfig.menu.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-white/75 transition duration-300 hover:text-primary hover:translate-x-0.5"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </motion.div>

          <motion.div
            {...fadeUp}
            transition={
              reduceMotion
                ? undefined
                : { duration: 0.6, ease: 'easeOut', delay: 0.2 }
            }
          >
            <h3 className="text-sm font-bold uppercase tracking-wide text-white">
              Contact
            </h3>
            <ul className="mt-4 space-y-3" role="list">
              <li className="flex items-start gap-2 text-sm text-white/75">
                <MapPin
                  aria-hidden="true"
                  className="mt-0.5 h-4 w-4 shrink-0 text-primary"
                />
                <span>{brandConfig.links.contact.address}</span>
              </li>
              <li className="flex items-center gap-2 text-sm text-white/75">
                <MessageCircle
                  aria-hidden="true"
                  className="h-4 w-4 shrink-0 text-primary"
                />
                <Link
                  isExternal
                  href={brandConfig.links.contact.whatsapp.href}
                  className="hover:text-primary"
                >
                  {brandConfig.links.contact.whatsapp.display}
                </Link>
              </li>
              <li className="flex items-center gap-2 text-sm text-white/75">
                <Mail
                  aria-hidden="true"
                  className="h-4 w-4 shrink-0 text-primary"
                />
                <Link
                  href={brandConfig.links.contact.email.href}
                  className="hover:text-primary"
                >
                  {brandConfig.links.contact.email.display}
                </Link>
              </li>
            </ul>
          </motion.div>
        </div>

        <motion.div
          className="border-t border-white/10 py-4 text-center text-sm text-white/60 md:py-5"
          initial={reduceMotion ? undefined : { opacity: 0 }}
          whileInView={reduceMotion ? undefined : { opacity: 1 }}
          viewport={{ once: true, amount: 0.8 }}
          transition={
            reduceMotion
              ? undefined
              : { duration: 0.5, ease: 'easeOut', delay: 0.3 }
          }
        >
          <p>&copy; {new Date().getFullYear()} EBA. Tous droits réservés.</p>
        </motion.div>
      </div>
    </footer>
  );
}

export default SiteFooter;
