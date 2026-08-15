'use client';

import Image from 'next/image';
import React from 'react';
import { Button, Link } from '@heroui/react';
import { ShoppingBag } from 'lucide-react';
import { RecentOrdersLink } from '@/components/(public)/commande/recent-orders-link';

// Le hero porte le LCP de l'accueil : tout ce qu'on lui fait hydrater retarde
// le moment où la page devient interactive. Son fondu d'entrée passait par
// Framer Motion — une animation jouée une fois, sans état ni geste, donc du
// travail de thread principal (arbre `motion`, valeurs animées, rAF) posé
// exactement sur l'élément le plus critique de la page. Le CSS fait la même
// chose pour zéro octet et zéro hydratation : cf. `.hero-rise` dans
// app/globals.css, qui gère aussi `prefers-reduced-motion`.
//
// Le composant reste `'use client'` : le barrel `@heroui/react` ne porte pas
// de directive `'use client'` et casse le rendu serveur (`createContext is
// not a function`). C'est le bouton HeroUI qui impose la frontière, plus
// l'animation.
function HeroSection() {
  return (
    <section className="relative min-h-svh w-full overflow-hidden">
      <Image
        src="/assets/examples/accueil/eba-hero-2.webp"
        alt="EBA Coffee Shop — intérieur chaleureux du coffee shop à Cocody, Abidjan"
        fill
        priority
        // Sans `sizes`, une image `fill` retombe sur `100vw` avec un
        // avertissement : on le pose explicitement, c'est bien la réalité ici.
        sizes="100vw"
        className="object-cover"
      />

      <div className="absolute inset-0 bg-black/55" aria-hidden="true" />

      <div className="hero-rise relative z-10 flex min-h-svh items-center justify-center px-6">
        <div className="mx-auto flex w-full max-w-4xl flex-col items-center gap-5 text-center text-white">
          <h3 className="rounded-full border border-white/40 bg-white/10 px-4 py-1 text-xs uppercase tracking-[0.2em]">
            EBA Coffee Shop
          </h3>

          <h1 className="text-balance text-4xl font-bold leading-tight sm:text-5xl md:text-6xl">
            Coffee shop à Abidjan — café, pâtisseries et brunch
          </h1>

          <p className="max-w-2xl text-pretty text-base text-white/90 sm:text-lg">
            Des boissons préparées avec soin, des pâtisseries maison et un cadre
            chaleureux.
          </p>

          <Button
            as={Link}
            href="/carte"
            color="primary"
            size="lg"
            radius="full"
            className="mt-2 px-8"
            startContent={<ShoppingBag className="h-5 w-5" aria-hidden />}
          >
            Voir la carte &amp; commander
          </Button>

          {/* Chemin de recommande immédiat pour un habitué — rendu `null` tant
              que cet appareil n'a rien commandé, donc invisible pour un
              nouveau visiteur. Habillage clair : le hero est sombre. */}
          <RecentOrdersLink className="border-white/40 bg-white/10 text-white hover:border-white/70 hover:text-white" />
        </div>
      </div>
    </section>
  );
}

export default HeroSection;
