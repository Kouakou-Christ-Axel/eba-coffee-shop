'use client';

import Image from 'next/image';
import React from 'react';
import { Link } from '@heroui/react';
import { m, useReducedMotion } from 'framer-motion';
import { MapPin, MessageCircle, Mail } from 'lucide-react';
import {
  IconBrandFacebook,
  IconBrandInstagram,
  IconBrandLinkedin,
  IconBrandTiktok,
  IconBrandX,
  IconBrandYoutube,
} from '@tabler/icons-react';
import { brandConfig } from '@/config/brand.config';
import { useStaffAccess } from '@/lib/hooks/use-staff-access';
import type { ContactSettings } from '@/lib/contact-settings';
import { buildWhatsAppLink } from '@/lib/contact-links';
import { buildSocialProfiles, type SocialNetworkKey } from '@/lib/social-links';
import { trackContactClick } from '@/lib/analytics';

// Le pied de page est le SEUL endroit du site présent sur toutes les pages :
// c'est donc lui qui porte les liens vers les profils sociaux, aussi bien pour
// le visiteur que pour les robots (qui relient ainsi le domaine aux comptes).
const SOCIAL_ICONS: Record<
  SocialNetworkKey,
  React.ComponentType<{ className?: string }>
> = {
  instagram: IconBrandInstagram,
  tiktok: IconBrandTiktok,
  facebook: IconBrandFacebook,
  x: IconBrandX,
  linkedin: IconBrandLinkedin,
  youtube: IconBrandYoutube,
};

function SiteFooter({ contact }: { contact: ContactSettings }) {
  const reduceMotion = useReducedMotion();
  const socialItems = buildSocialProfiles(contact);
  const whatsappHref = buildWhatsAppLink(contact.whatsapp) ?? '#';
  // Résolu APRÈS l'hydratation et hors du chunk initial (cf. `useStaffAccess`) :
  // le lien affiche donc « Connexion » d'abord, ce qui est déjà la bonne
  // réponse pour l'écrasante majorité des visiteurs du site vitrine.
  const hasDashboardAccess = useStaffAccess();
  // Point d'accès indispensable dans la PWA installée (pas de barre d'adresse) :
  // « Connexion » si déconnecté, sinon raccourci vers le dashboard pour le staff.
  const accountLink = hasDashboardAccess
    ? { href: '/dashboard', label: 'Dashboard' }
    : { href: '/login', label: 'Connexion' };

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
      <div className="content-container">
        <m.div className="flex items-center justify-between border-b border-white/10 py-6 md:py-7">
          <Image
            src="/assets/logos/eba_white_n.webp"
            alt="EBA Coffee Shop — café et pâtisserie à Abidjan"
            width={48}
            height={48}
          />
          {/* `-mr-2.5` compense la zone tactile ajoutée à droite du dernier
              icone, pour que la rangée reste alignée sur le bord du contenu. */}
          <div className="-mr-2.5 flex items-center gap-1">
            {socialItems.map((social) => {
              const Icon = SOCIAL_ICONS[social.key];
              return (
                <Link
                  key={social.key}
                  isExternal
                  href={social.url}
                  aria-label={`Suivez EBA sur ${social.label}`}
                  // L'icone reste à 20 px ; c'est la zone CLIQUABLE qui passe à
                  // 44 px. À 20x20 la cible était sous le minimum de 24 px du
                  // WCAG 2.2 (2.5.8) et bien loin des ~44 px confortables au
                  // pouce — sur un site dont le trafic est massivement mobile.
                  className="flex h-11 w-11 items-center justify-center text-white/70 transition duration-300 hover:text-primary"
                >
                  <Icon className="h-5 w-5" />
                </Link>
              );
            })}
          </div>
        </m.div>

        <div className="grid gap-8 py-8 md:grid-cols-3 md:py-9 lg:gap-12">
          <m.div
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
          </m.div>

          <m.div
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
            {/* `py-1.5` sur chaque lien : la ligne de texte seule ne fait que
                20 px de haut, sous le minimum de 24 px du WCAG 2.2 (2.5.8).
                L'espacement de la liste se resserre d'autant pour que le bloc
                garde sa hauteur — la cible grandit, pas le footer. */}
            <ul className="mt-3 space-y-0.5" role="list">
              {brandConfig.menu.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="block py-1.5 text-sm text-white/75 transition duration-300 hover:text-primary hover:translate-x-0.5"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
              <li key={accountLink.href}>
                <Link
                  href={accountLink.href}
                  className="block py-1.5 text-sm text-white/75 transition duration-300 hover:text-primary hover:translate-x-0.5"
                >
                  {accountLink.label}
                </Link>
              </li>
            </ul>
          </m.div>

          <m.div
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
            {/* Même traitement que la colonne Navigation : `py-1.5` amène le
                numéro et l'email au-dessus des 24 px, et l'espacement de la
                liste se resserre pour compenser. Ce sont les deux liens de
                contact direct du footer — ceux qu'on vise au pouce. */}
            <ul className="mt-3 space-y-1.5" role="list">
              <li className="flex items-start gap-2 py-1.5 text-sm text-white/75">
                <MapPin
                  aria-hidden="true"
                  className="mt-0.5 h-4 w-4 shrink-0 text-primary"
                />
                <span>{contact.address}</span>
              </li>
              <li className="flex items-center gap-2 text-sm text-white/75">
                <MessageCircle
                  aria-hidden="true"
                  className="h-4 w-4 shrink-0 text-primary"
                />
                <Link
                  isExternal
                  href={whatsappHref}
                  onPress={() => trackContactClick('whatsapp', 'footer')}
                  className="py-1.5 hover:text-primary"
                >
                  {contact.whatsapp}
                </Link>
              </li>
              <li className="flex items-center gap-2 text-sm text-white/75">
                <Mail
                  aria-hidden="true"
                  className="h-4 w-4 shrink-0 text-primary"
                />
                <Link
                  href={`mailto:${contact.email}`}
                  className="py-1.5 hover:text-primary"
                >
                  {contact.email}
                </Link>
              </li>
            </ul>
          </m.div>
        </div>

        <m.div
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
          <p>
            &copy; {new Date().getFullYear()} EBA. Tous droits réservés.
            {' · '}
            <Link
              href="/cookies"
              className="inline-block py-1.5 text-sm text-white/60 underline underline-offset-2 hover:text-primary"
            >
              Cookies
            </Link>
          </p>
        </m.div>
      </div>
    </footer>
  );
}

export default SiteFooter;
