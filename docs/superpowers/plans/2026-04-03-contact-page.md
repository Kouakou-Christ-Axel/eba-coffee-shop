# Contact Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an immersive contact page for EBA Coffee Shop with GSAP animations (SplitText, ScrollTrigger), quick-access cards, a contact form, Google Maps, and a WhatsApp CTA.

**Architecture:** 5 client components composed by a server page component. All animations use GSAP (`useGSAP` hook) with `ScrollTrigger` for scroll-triggered reveals and `SplitText` for the hero title. Each section is a standalone `'use client'` component in `components/(public)/contact/`. The page follows the existing patterns: `content-container` class for max-width, HeroUI components for UI, lucide-react for icons.

**Tech Stack:** Next.js 16 App Router, React 19, GSAP (ScrollTrigger, SplitText), HeroUI (Input, Select, Textarea, Button, Card, CardBody, Link), lucide-react, Tailwind CSS v4

**Spec:** `docs/superpowers/specs/2026-04-03-contact-page-design.md`

---

### Task 1: Contact Hero Section

**Files:**

- Create: `components/(public)/contact/contact-hero-section.tsx`

- [ ] **Step 1: Create the hero section component**

```tsx
'use client';

import Image from 'next/image';
import React, { useRef } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { SplitText } from 'gsap/SplitText';

gsap.registerPlugin(useGSAP, SplitText);

function ContactHeroSection() {
  const sectionRef = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();

      mm.add('(prefers-reduced-motion: no-preference)', () => {
        gsap.from('.contact-hero-image', {
          scale: 1.08,
          duration: 1.6,
          ease: 'power2.out',
        });

        SplitText.create('.contact-hero-title', {
          type: 'words',
          autoSplit: true,
          onSplit(self) {
            return gsap.from(self.words, {
              opacity: 0,
              y: 30,
              stagger: 0.08,
              duration: 0.6,
              ease: 'power3.out',
              delay: 0.3,
            });
          },
        });

        gsap.from('.contact-hero-subtitle', {
          opacity: 0,
          y: 20,
          duration: 0.8,
          ease: 'power2.out',
          delay: 0.8,
        });
      });
    },
    { scope: sectionRef }
  );

  return (
    <section
      ref={sectionRef}
      aria-labelledby="contact-hero-title"
      className="relative flex min-h-svh items-center justify-center overflow-hidden"
    >
      <div className="contact-hero-image absolute inset-0" aria-hidden="true">
        <Image
          src="/assets/examples/accueil/eba-hero.webp"
          alt="Ambiance chaleureuse du coffee shop EBA a Abidjan"
          fill
          priority
          className="object-cover"
          sizes="100vw"
        />
      </div>

      <div className="absolute inset-0 bg-black/50" aria-hidden="true" />

      <div className="relative z-10 px-6 text-center text-white">
        <div className="mx-auto max-w-3xl">
          <h1
            id="contact-hero-title"
            className="contact-hero-title text-balance text-4xl font-semibold leading-tight sm:text-5xl md:text-6xl"
          >
            Parlons autour d&apos;un cafe
          </h1>

          <p className="contact-hero-subtitle mx-auto mt-5 max-w-2xl text-pretty text-base text-white/90 sm:text-lg">
            Une question, une reservation ou un projet ? On vous repond avec
            plaisir.
          </p>
        </div>
      </div>
    </section>
  );
}

export default ContactHeroSection;
```

- [ ] **Step 2: Verify the component renders**

Run: `bun dev`

Open `http://localhost:3000` and manually import the component temporarily, or wait until Task 6 when the page is assembled.

- [ ] **Step 3: Commit**

```bash
git add "components/(public)/contact/contact-hero-section.tsx"
git commit -m "feat(contact): add hero section with GSAP SplitText animation"
```

---

### Task 2: Quick Access Section

**Files:**

- Create: `components/(public)/contact/contact-quick-access-section.tsx`

- [ ] **Step 1: Create the quick access section component**

```tsx
'use client';

import React, { useRef } from 'react';
import Image from 'next/image';
import { Button, Card, CardBody, Link } from '@heroui/react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { MapPin, MessageCircle, Phone } from 'lucide-react';

gsap.registerPlugin(useGSAP, ScrollTrigger);

const quickAccessItems = [
  {
    label: 'WhatsApp',
    value: '+225 07 00 00 00 00',
    icon: MessageCircle,
    cta: 'Ecrire sur WhatsApp',
    href: 'https://wa.me/2250700000000',
    external: true,
  },
  {
    label: 'Telephone',
    value: '+225 27 22 00 00 00',
    icon: Phone,
    cta: 'Appeler',
    href: 'tel:+2252722000000',
    external: false,
  },
  {
    label: 'Itineraire',
    value: 'Boulevard Latrille, Cocody, Abidjan',
    icon: MapPin,
    cta: "Voir l'itineraire",
    href: 'https://maps.google.com/?q=Boulevard+Latrille+Cocody+Abidjan',
    external: true,
  },
];

function ContactQuickAccessSection() {
  const sectionRef = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();

      mm.add('(prefers-reduced-motion: no-preference)', () => {
        gsap.from('.quick-access-card', {
          x: -30,
          opacity: 0,
          stagger: 0.12,
          duration: 0.7,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: '.quick-access-cards',
            start: 'top 80%',
          },
        });

        gsap.from('.quick-access-image', {
          x: 30,
          opacity: 0,
          duration: 0.8,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: '.quick-access-image',
            start: 'top 80%',
          },
        });
      });
    },
    { scope: sectionRef }
  );

  return (
    <section
      ref={sectionRef}
      aria-labelledby="quick-access-title"
      className="bg-[linear-gradient(180deg,rgba(255,252,248,1)_0%,rgba(250,246,242,1)_100%)] py-14 md:py-20"
    >
      <div className="content-container px-6">
        <h2
          id="quick-access-title"
          className="mb-8 text-3xl font-bold tracking-tight sm:text-4xl"
        >
          Nous contacter
        </h2>

        <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
          <ul className="quick-access-cards space-y-4" role="list">
            {quickAccessItems.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.label} className="quick-access-card">
                  <Card className="border border-default-200/70 bg-content1/90 shadow-sm">
                    <CardBody className="flex flex-row items-center gap-4 p-5">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10">
                        <Icon
                          aria-hidden="true"
                          className="h-5 w-5 text-primary"
                        />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-foreground">
                          {item.label}
                        </p>
                        <p className="text-sm text-foreground/75">
                          {item.value}
                        </p>
                      </div>
                      <Button
                        as={Link}
                        href={item.href}
                        {...(item.external
                          ? { target: '_blank', rel: 'noopener noreferrer' }
                          : {})}
                        color="primary"
                        variant="flat"
                        radius="full"
                        size="sm"
                      >
                        {item.cta}
                      </Button>
                    </CardBody>
                  </Card>
                </li>
              );
            })}
          </ul>

          <div className="quick-access-image">
            <Card className="overflow-hidden border border-default-200/70 bg-content1 shadow-xl">
              <div className="relative h-72 w-full sm:h-80 lg:h-full lg:min-h-80">
                <Image
                  src="/assets/examples/accueil/eba-hero-2.png"
                  alt="Interieur chaleureux du coffee shop EBA"
                  fill
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  className="object-cover"
                />
              </div>
            </Card>
          </div>
        </div>
      </div>
    </section>
  );
}

export default ContactQuickAccessSection;
```

- [ ] **Step 2: Commit**

```bash
git add "components/(public)/contact/contact-quick-access-section.tsx"
git commit -m "feat(contact): add quick access section with WhatsApp, phone, directions"
```

---

### Task 3: Contact Form Section

**Files:**

- Create: `components/(public)/contact/contact-form-section.tsx`

- [ ] **Step 1: Create the form section component**

```tsx
'use client';

import React, { useRef, useState } from 'react';
import Image from 'next/image';
import {
  Button,
  Card,
  Input,
  Select,
  SelectItem,
  Textarea,
} from '@heroui/react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Send } from 'lucide-react';

gsap.registerPlugin(useGSAP, ScrollTrigger);

const motifs = [
  { key: 'question', label: 'Question generale' },
  { key: 'partenariat', label: 'Partenariat' },
  { key: 'reservation', label: 'Reservation' },
];

function ContactFormSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const [motif, setMotif] = useState('');
  const [nom, setNom] = useState('');
  const [email, setEmail] = useState('');
  const [telephone, setTelephone] = useState('');
  const [message, setMessage] = useState('');

  useGSAP(
    () => {
      const mm = gsap.matchMedia();

      mm.add('(prefers-reduced-motion: no-preference)', () => {
        gsap.from('.form-image', {
          opacity: 0,
          duration: 0.8,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: '.form-image',
            start: 'top 80%',
          },
        });

        gsap.from('.form-field', {
          y: 20,
          opacity: 0,
          stagger: 0.08,
          duration: 0.6,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: '.form-fields',
            start: 'top 80%',
          },
        });

        gsap.from('.form-submit', {
          scale: 0.9,
          opacity: 0,
          duration: 0.5,
          ease: 'back.out(1.7)',
          scrollTrigger: {
            trigger: '.form-submit',
            start: 'top 90%',
          },
        });
      });
    },
    { scope: sectionRef }
  );

  return (
    <section
      ref={sectionRef}
      aria-labelledby="contact-form-title"
      className="bg-muted/35 py-14 md:py-20"
    >
      <div className="content-container px-6">
        <div className="grid items-center gap-8 lg:grid-cols-2 lg:gap-12">
          <div className="form-image">
            <Card className="overflow-hidden border border-default-200/70 bg-content1 shadow-xl">
              <div className="relative h-72 w-full sm:h-80 lg:h-120">
                <Image
                  src="/assets/examples/accueil/eba-hero.webp"
                  alt="Ambiance cafe et patisserie chez EBA"
                  fill
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  className="object-cover"
                />
              </div>
            </Card>
          </div>

          <div>
            <h2
              id="contact-form-title"
              className="mb-6 text-3xl font-bold tracking-tight sm:text-4xl"
            >
              Ecrivez-nous
            </h2>

            <form
              className="form-fields space-y-4"
              onSubmit={(e) => e.preventDefault()}
            >
              <div className="form-field">
                <Select
                  label="Motif"
                  placeholder="Choisissez un motif"
                  selectedKeys={motif ? [motif] : []}
                  onSelectionChange={(keys) => {
                    const selected = Array.from(keys)[0];
                    setMotif(selected ? String(selected) : '');
                  }}
                  isRequired
                >
                  {motifs.map((m) => (
                    <SelectItem key={m.key}>{m.label}</SelectItem>
                  ))}
                </Select>
              </div>

              <div className="form-field">
                <Input
                  label="Nom complet"
                  placeholder="Votre nom"
                  value={nom}
                  onValueChange={setNom}
                  isRequired
                />
              </div>

              <div className="form-field">
                <Input
                  label="Email"
                  type="email"
                  placeholder="votre@email.com"
                  value={email}
                  onValueChange={setEmail}
                  isRequired
                />
              </div>

              <div className="form-field">
                <Input
                  label="Telephone"
                  type="tel"
                  placeholder="+225 00 00 00 00 00"
                  value={telephone}
                  onValueChange={setTelephone}
                />
              </div>

              <div className="form-field">
                <Textarea
                  label="Message"
                  placeholder="Votre message..."
                  value={message}
                  onValueChange={setMessage}
                  minRows={4}
                  isRequired
                />
              </div>

              <div className="form-submit pt-2">
                <Button
                  type="submit"
                  color="primary"
                  radius="full"
                  size="lg"
                  className="px-8"
                  startContent={<Send aria-hidden="true" className="h-4 w-4" />}
                >
                  Envoyer le message
                </Button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}

export default ContactFormSection;
```

- [ ] **Step 2: Commit**

```bash
git add "components/(public)/contact/contact-form-section.tsx"
git commit -m "feat(contact): add form section with motif select and GSAP stagger"
```

---

### Task 4: Map Section

**Files:**

- Create: `components/(public)/contact/contact-map-section.tsx`

- [ ] **Step 1: Create the map section component**

```tsx
'use client';

import React, { useRef } from 'react';
import { Card, CardBody } from '@heroui/react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Clock3, MapPin } from 'lucide-react';

gsap.registerPlugin(useGSAP, ScrollTrigger);

const infoItems = [
  {
    icon: MapPin,
    label: 'Adresse',
    value: 'Boulevard Latrille, Cocody, Abidjan',
  },
  {
    icon: MapPin,
    label: 'Repere',
    value: 'A 2 min du carrefour Duncan',
  },
  {
    icon: Clock3,
    label: 'Horaires',
    value: 'Lun - Dim : 7h30 - 21h30',
  },
];

function ContactMapSection() {
  const sectionRef = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();

      mm.add('(prefers-reduced-motion: no-preference)', () => {
        gsap.from('.map-iframe', {
          opacity: 0,
          duration: 0.8,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: '.map-iframe',
            start: 'top 85%',
          },
        });

        gsap.from('.map-info-card', {
          y: 30,
          opacity: 0,
          duration: 0.7,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: '.map-info-card',
            start: 'top 90%',
          },
        });
      });
    },
    { scope: sectionRef }
  );

  return (
    <section ref={sectionRef} aria-labelledby="map-section-title">
      <h2 id="map-section-title" className="sr-only">
        Nous trouver
      </h2>

      <div className="relative h-80 w-full md:h-96">
        <iframe
          title="Carte Google Maps EBA a Abidjan"
          src="https://www.google.com/maps?q=Boulevard+Latrille+Cocody+Abidjan&output=embed"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          className="map-iframe h-full w-full border-0"
        />

        <Card className="map-info-card absolute bottom-4 left-4 right-4 border border-default-200/70 bg-content1/95 shadow-lg backdrop-blur-md sm:left-6 sm:right-auto sm:max-w-sm">
          <CardBody className="gap-3 p-5">
            {infoItems.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.label} className="flex items-start gap-3">
                  <Icon
                    aria-hidden="true"
                    className="mt-0.5 h-4.5 w-4.5 shrink-0 text-primary"
                  />
                  <div className="text-sm">
                    <p className="font-medium text-foreground">{item.label}</p>
                    <p className="text-foreground/75">{item.value}</p>
                  </div>
                </div>
              );
            })}
          </CardBody>
        </Card>
      </div>
    </section>
  );
}

export default ContactMapSection;
```

- [ ] **Step 2: Commit**

```bash
git add "components/(public)/contact/contact-map-section.tsx"
git commit -m "feat(contact): add map section with info overlay card"
```

---

### Task 5: CTA WhatsApp Section

**Files:**

- Create: `components/(public)/contact/contact-cta-section.tsx`

- [ ] **Step 1: Create the CTA section component**

```tsx
'use client';

import React, { useRef } from 'react';
import { Button, Link } from '@heroui/react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { MessageCircle } from 'lucide-react';

gsap.registerPlugin(useGSAP, ScrollTrigger);

function ContactCtaSection() {
  const sectionRef = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();

      mm.add('(prefers-reduced-motion: no-preference)', () => {
        gsap.from('.cta-content', {
          scale: 0.95,
          opacity: 0,
          duration: 0.8,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: '.cta-content',
            start: 'top 85%',
          },
        });
      });
    },
    { scope: sectionRef }
  );

  return (
    <section
      ref={sectionRef}
      aria-labelledby="cta-title"
      className="bg-primary py-14 md:py-20"
    >
      <div className="cta-content content-container px-6 text-center">
        <h2
          id="cta-title"
          className="text-3xl font-bold tracking-tight text-white sm:text-4xl"
        >
          Envie de commander ?
        </h2>

        <p className="mx-auto mt-4 max-w-xl text-base text-white/80 sm:text-lg">
          Passez votre commande directement sur WhatsApp, on s&apos;occupe du
          reste.
        </p>

        <div className="mt-8">
          <Button
            as={Link}
            href="https://wa.me/2250700000000"
            target="_blank"
            rel="noopener noreferrer"
            color="secondary"
            size="lg"
            radius="full"
            className="px-8"
            startContent={
              <MessageCircle aria-hidden="true" className="h-5 w-5" />
            }
          >
            Commander sur WhatsApp
          </Button>
        </div>
      </div>
    </section>
  );
}

export default ContactCtaSection;
```

- [ ] **Step 2: Commit**

```bash
git add "components/(public)/contact/contact-cta-section.tsx"
git commit -m "feat(contact): add WhatsApp CTA banner section"
```

---

### Task 6: Assemble Contact Page

**Files:**

- Modify: `app/(public)/contact/page.tsx`

- [ ] **Step 1: Update the contact page to compose all sections and add metadata**

```tsx
import type { Metadata } from 'next';
import ContactHeroSection from '@/components/(public)/contact/contact-hero-section';
import ContactQuickAccessSection from '@/components/(public)/contact/contact-quick-access-section';
import ContactFormSection from '@/components/(public)/contact/contact-form-section';
import ContactMapSection from '@/components/(public)/contact/contact-map-section';
import ContactCtaSection from '@/components/(public)/contact/contact-cta-section';

export const metadata: Metadata = {
  title: 'Contact | EBA Coffee Shop',
  description:
    'Contactez EBA Coffee Shop a Abidjan. Reservation, question ou partenariat — ecrivez-nous ou passez nous voir a Cocody.',
};

export default function ContactPage() {
  return (
    <>
      <ContactHeroSection />
      <ContactQuickAccessSection />
      <ContactFormSection />
      <ContactMapSection />
      <ContactCtaSection />
    </>
  );
}
```

- [ ] **Step 2: Run dev server and verify the full page**

Run: `bun dev`

Open `http://localhost:3000/contact` and verify:

- Hero renders full-screen with SplitText title animation
- Quick access cards animate in from left with stagger
- Form fields animate in with stagger on scroll
- Map section shows Google Maps with info overlay
- CTA banner has purple background with gold WhatsApp button
- All animations respect `prefers-reduced-motion`

- [ ] **Step 3: Commit**

```bash
git add "app/(public)/contact/page.tsx"
git commit -m "feat(contact): assemble contact page with all sections and metadata"
```

---

### Task 7: Build Verification

- [ ] **Step 1: Run lint**

Run: `bun run lint`

Expected: No errors

- [ ] **Step 2: Run production build**

Run: `bun build`

Expected: Build succeeds with no errors. The contact page should appear in the routes output.

- [ ] **Step 3: Fix any issues found and commit fixes**

If lint or build errors are found, fix them and commit:

```bash
git add -A
git commit -m "fix(contact): resolve lint/build issues"
```
