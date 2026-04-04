'use client';

import Image from 'next/image';
import React from 'react';
import { Button, Link } from '@heroui/react';

function HeroSection() {
  return (
    <section className="relative min-h-svh w-full overflow-hidden">
      <Image
        src="/assets/examples/accueil/eba-hero-2.png"
        alt="Ambiance EBA Coffee Shop"
        fill
        priority
        className="object-cover"
      />

      <div className="absolute inset-0 bg-black/55" aria-hidden="true" />

      <div className="relative z-10 flex min-h-svh items-center justify-center px-6">
        <div className="mx-auto flex w-full max-w-4xl flex-col items-center gap-5 text-center text-white">
          <h3 className="rounded-full border border-white/40 bg-white/10 px-4 py-1 text-xs uppercase tracking-[0.2em]">
            EBA Coffee Shop
          </h3>

          <h1 className="text-balance text-4xl font-bold leading-tight sm:text-5xl md:text-6xl">
            Un café d&apos;exception dans une ambiance chaleureuse
          </h1>

          <p className="max-w-2xl text-pretty text-base text-white/90 sm:text-lg">
            Découvrez nos boissons signature, nos douceurs maison et prenez le
            temps de savourer chaque instant.
          </p>

          <Button
            as={Link}
            href="/carte"
            color="primary"
            size="lg"
            radius="full"
            className="mt-2 px-8"
          >
            Voir la carte
          </Button>
        </div>
      </div>
    </section>
  );
}

export default HeroSection;
