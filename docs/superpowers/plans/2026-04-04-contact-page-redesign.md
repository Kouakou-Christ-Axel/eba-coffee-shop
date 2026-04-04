# Contact Page Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the contact page with 3 interconnected sections (hero+cards, form, map+overlay), replacing GSAP with Framer Motion.

**Architecture:** Rewrite 3 component files, delete 2, edit the page file. All animations use Framer Motion with useReducedMotion. Overlapping cards create visual continuity between sections.

**Tech Stack:** Next.js, React 19, HeroUI, Framer Motion, Lucide React, Tailwind CSS v4

---

### Task 1: Rewrite contact-hero-section.tsx (Hero + overlapping contact cards)

**Files:**

- Rewrite: `components/(public)/contact/contact-hero-section.tsx`

- [ ] **Step 1: Rewrite the hero section with overlapping cards**

```tsx
'use client';

import Image from 'next/image';
import React from 'react';
import { Link } from '@heroui/react';
import { motion, useReducedMotion } from 'framer-motion';
import { MapPin, MessageCircle, Phone } from 'lucide-react';

const contactCards = [
  {
    label: 'WhatsApp',
    value: '+225 07 00 00 00 00',
    icon: MessageCircle,
    href: 'https://wa.me/2250700000000',
    external: true,
    color: 'bg-primary/10 text-primary',
  },
  {
    label: 'Telephone',
    value: '+225 27 22 00 00 00',
    icon: Phone,
    href: 'tel:+2252722000000',
    external: false,
    color: 'bg-secondary/10 text-secondary',
  },
  {
    label: 'Nous trouver',
    value: 'Blvd Latrille, Cocody',
    icon: MapPin,
    href: 'https://maps.google.com/?q=Boulevard+Latrille+Cocody+Abidjan',
    external: true,
    color: 'bg-primary/10 text-primary',
  },
];

function ContactHeroSection() {
  const reduceMotion = useReducedMotion();

  const fadeUp = reduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: 20 },
        whileInView: { opacity: 1, y: 0 },
        viewport: { once: true },
        transition: { duration: 0.6, ease: 'easeOut' as const },
      };

  return (
    <section aria-labelledby="contact-hero-title" className="relative">
      {/* Hero area */}
      <div className="relative flex min-h-[50vh] items-center justify-center overflow-hidden">
        <Image
          src="/assets/examples/accueil/eba-hero.webp"
          alt="Ambiance chaleureuse du coffee shop EBA a Abidjan"
          fill
          priority
          className="object-cover"
          sizes="100vw"
        />

        <div className="absolute inset-0 bg-black/50" aria-hidden="true" />

        <div className="relative z-10 px-6 pb-20 text-center text-white">
          <div className="mx-auto max-w-3xl">
            <motion.h3
              className="rounded-full border border-white/40 bg-white/10 px-4 py-1 text-xs uppercase tracking-[0.2em] inline-block"
              {...fadeUp}
            >
              Contact
            </motion.h3>

            <motion.h1
              id="contact-hero-title"
              className="mt-5 text-balance text-3xl font-bold leading-tight sm:text-4xl md:text-5xl"
              {...fadeUp}
              transition={
                reduceMotion
                  ? undefined
                  : { duration: 0.6, ease: 'easeOut', delay: 0.1 }
              }
            >
              Parlons autour d&apos;un cafe
            </motion.h1>

            <motion.p
              className="mx-auto mt-4 max-w-2xl text-pretty text-base text-white/80 sm:text-lg"
              {...fadeUp}
              transition={
                reduceMotion
                  ? undefined
                  : { duration: 0.6, ease: 'easeOut', delay: 0.2 }
              }
            >
              On vous repond en moins d&apos;une heure sur WhatsApp
            </motion.p>
          </div>
        </div>
      </div>

      {/* Overlapping contact cards */}
      <div className="relative z-10 mx-auto -mt-12 max-w-3xl px-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {contactCards.map((card, index) => {
            const Icon = card.icon;
            return (
              <motion.div
                key={card.label}
                initial={reduceMotion ? undefined : { opacity: 0, y: 20 }}
                whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={
                  reduceMotion
                    ? undefined
                    : {
                        duration: 0.5,
                        ease: 'easeOut',
                        delay: 0.3 + index * 0.08,
                      }
                }
              >
                <Link
                  href={card.href}
                  {...(card.external
                    ? { target: '_blank', rel: 'noopener noreferrer' }
                    : {})}
                  className="block rounded-xl bg-background p-6 text-center shadow-md transition-shadow hover:shadow-lg"
                >
                  <div
                    className={`mx-auto flex h-12 w-12 items-center justify-center rounded-full ${card.color}`}
                  >
                    <Icon aria-hidden="true" className="h-5 w-5" />
                  </div>
                  <p className="mt-3 font-semibold text-foreground">
                    {card.label}
                  </p>
                  <p className="mt-1 text-sm text-foreground/70">
                    {card.value}
                  </p>
                </Link>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export default ContactHeroSection;
```

- [ ] **Step 2: Commit**

```bash
git add components/(public)/contact/contact-hero-section.tsx
git commit -m "feat(contact): rewrite hero section with overlapping contact cards and Framer Motion"
```

---

### Task 2: Rewrite contact-form-section.tsx (Full-width form)

**Files:**

- Rewrite: `components/(public)/contact/contact-form-section.tsx`

- [ ] **Step 1: Rewrite the form section**

```tsx
'use client';

import React, { useState } from 'react';
import { Button, Input, Select, SelectItem, Textarea } from '@heroui/react';
import { motion, useReducedMotion } from 'framer-motion';
import { Send } from 'lucide-react';

const motifs = [
  { key: 'question', label: 'Question generale' },
  { key: 'reservation', label: 'Reservation' },
  { key: 'partenariat', label: 'Partenariat' },
];

function ContactFormSection() {
  const reduceMotion = useReducedMotion();
  const [motif, setMotif] = useState('');

  const containerVariants = reduceMotion
    ? {}
    : {
        initial: 'hidden' as const,
        whileInView: 'visible' as const,
        viewport: { once: true, amount: 0.3 },
        variants: {
          hidden: {},
          visible: { transition: { staggerChildren: 0.06 } },
        },
      };

  const itemVariants = reduceMotion
    ? {}
    : {
        variants: {
          hidden: { opacity: 0, y: 16 },
          visible: {
            opacity: 1,
            y: 0,
            transition: { duration: 0.5, ease: 'easeOut' as const },
          },
        },
      };

  return (
    <section
      aria-labelledby="contact-form-title"
      className="bg-[linear-gradient(180deg,rgba(255,252,248,1)_0%,rgba(250,246,242,1)_100%)] pt-24 pb-14 md:pb-20"
    >
      <div className="content-container px-6">
        <div className="mx-auto max-w-2xl">
          <motion.div
            className="mb-8 text-center"
            initial={reduceMotion ? undefined : { opacity: 0, y: 16 }}
            whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={
              reduceMotion ? undefined : { duration: 0.6, ease: 'easeOut' }
            }
          >
            <h2
              id="contact-form-title"
              className="text-2xl font-bold tracking-tight sm:text-3xl"
            >
              Envoyez-nous un message
            </h2>
            <p className="mt-2 text-foreground/70">
              Pour une reservation, un partenariat ou une question
            </p>
          </motion.div>

          <motion.form
            onSubmit={(e) => e.preventDefault()}
            className="space-y-4"
            {...containerVariants}
          >
            <motion.div
              className="grid grid-cols-1 gap-4 sm:grid-cols-2"
              {...itemVariants}
            >
              <Input
                label="Nom complet"
                placeholder="Votre nom"
                variant="bordered"
                radius="lg"
                isRequired
              />
              <Input
                label="Email"
                type="email"
                placeholder="votre@email.com"
                variant="bordered"
                radius="lg"
                isRequired
              />
            </motion.div>

            <motion.div
              className="grid grid-cols-1 gap-4 sm:grid-cols-2"
              {...itemVariants}
            >
              <Input
                label="Telephone"
                type="tel"
                placeholder="+225 00 00 00 00 00"
                variant="bordered"
                radius="lg"
              />
              <Select
                label="Motif"
                placeholder="Choisissez un motif"
                variant="bordered"
                radius="lg"
                selectedKeys={motif ? [motif] : []}
                onSelectionChange={(keys) => {
                  const selected = Array.from(keys)[0];
                  setMotif(selected ? String(selected) : '');
                }}
              >
                {motifs.map((m) => (
                  <SelectItem key={m.key}>{m.label}</SelectItem>
                ))}
              </Select>
            </motion.div>

            <motion.div {...itemVariants}>
              <Textarea
                label="Message"
                placeholder="Votre message..."
                variant="bordered"
                radius="lg"
                minRows={4}
                isRequired
              />
            </motion.div>

            <motion.div className="pt-2" {...itemVariants}>
              <Button
                type="submit"
                color="primary"
                radius="full"
                size="lg"
                className="w-full px-8 sm:w-auto"
                endContent={<Send aria-hidden="true" className="h-4 w-4" />}
              >
                Envoyer le message
              </Button>
            </motion.div>
          </motion.form>
        </div>
      </div>
    </section>
  );
}

export default ContactFormSection;
```

- [ ] **Step 2: Commit**

```bash
git add components/(public)/contact/contact-form-section.tsx
git commit -m "feat(contact): rewrite form section with 2-col grid and Framer Motion"
```

---

### Task 3: Rewrite contact-map-section.tsx (Map + info overlay)

**Files:**

- Rewrite: `components/(public)/contact/contact-map-section.tsx`

- [ ] **Step 1: Rewrite the map section**

```tsx
'use client';

import React from 'react';
import { Button, Link } from '@heroui/react';
import { motion, useReducedMotion } from 'framer-motion';
import { Clock3, MapPin } from 'lucide-react';

function ContactMapSection() {
  const reduceMotion = useReducedMotion();

  return (
    <section aria-labelledby="map-section-title" className="relative">
      <h2 id="map-section-title" className="sr-only">
        Nous trouver
      </h2>

      <div className="relative h-80 w-full md:h-[28rem]">
        <iframe
          title="Carte Google Maps EBA a Abidjan"
          src="https://www.google.com/maps?q=Boulevard+Latrille+Cocody+Abidjan&output=embed"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          className="h-full w-full border-0"
        />

        <motion.div
          className="absolute bottom-4 left-4 max-w-xs rounded-xl bg-background/95 p-4 shadow-lg backdrop-blur-md md:bottom-6 md:left-6 md:p-5"
          initial={reduceMotion ? undefined : { opacity: 0, y: 12 }}
          whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={
            reduceMotion
              ? undefined
              : { duration: 0.6, ease: 'easeOut', delay: 0.3 }
          }
        >
          <div className="space-y-2.5">
            <div className="flex items-start gap-2.5">
              <Clock3
                aria-hidden="true"
                className="mt-0.5 h-4 w-4 shrink-0 text-primary"
              />
              <div className="text-sm">
                <p className="font-medium text-foreground">
                  Lun - Dim : 7h30 - 21h30
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2.5">
              <MapPin
                aria-hidden="true"
                className="mt-0.5 h-4 w-4 shrink-0 text-primary"
              />
              <div className="text-sm">
                <p className="text-foreground/75">
                  A 2 min du carrefour Duncan
                </p>
              </div>
            </div>
          </div>

          <Button
            as={Link}
            href="https://maps.google.com/?q=Boulevard+Latrille+Cocody+Abidjan"
            target="_blank"
            rel="noopener noreferrer"
            variant="bordered"
            color="secondary"
            radius="full"
            size="sm"
            className="mt-3"
          >
            Voir l&apos;itineraire
          </Button>
        </motion.div>
      </div>
    </section>
  );
}

export default ContactMapSection;
```

- [ ] **Step 2: Commit**

```bash
git add components/(public)/contact/contact-map-section.tsx
git commit -m "feat(contact): rewrite map section with info overlay and Framer Motion"
```

---

### Task 4: Update page.tsx and delete unused files

**Files:**

- Modify: `app/(public)/contact/page.tsx`
- Delete: `components/(public)/contact/contact-quick-access-section.tsx`
- Delete: `components/(public)/contact/contact-cta-section.tsx`

- [ ] **Step 1: Update the page composition**

```tsx
import type { Metadata } from 'next';
import ContactHeroSection from '@/components/(public)/contact/contact-hero-section';
import ContactFormSection from '@/components/(public)/contact/contact-form-section';
import ContactMapSection from '@/components/(public)/contact/contact-map-section';

export const metadata: Metadata = {
  title: 'Contact | EBA Coffee Shop',
  description:
    'Contactez EBA Coffee Shop a Abidjan. Reservation, question ou partenariat — ecrivez-nous ou passez nous voir a Cocody.',
};

export default function ContactPage() {
  return (
    <>
      <ContactHeroSection />
      <ContactFormSection />
      <ContactMapSection />
    </>
  );
}
```

- [ ] **Step 2: Delete unused component files**

```bash
rm components/(public)/contact/contact-quick-access-section.tsx
rm components/(public)/contact/contact-cta-section.tsx
```

- [ ] **Step 3: Commit**

```bash
git add app/(public)/contact/page.tsx
git add components/(public)/contact/contact-quick-access-section.tsx
git add components/(public)/contact/contact-cta-section.tsx
git commit -m "feat(contact): update page composition and remove unused sections"
```

---

### Task 5: Verify build

- [ ] **Step 1: Run build to verify no errors**

```bash
bun run build
```

Expected: Build succeeds with no TypeScript or import errors.

- [ ] **Step 2: Commit any fixes if needed**
