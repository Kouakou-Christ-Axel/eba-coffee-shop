import Image from 'next/image';
import React from 'react';

function HeroSection() {
  return (
    <section
      aria-labelledby="le-lieu-hero-title"
      className="relative isolate min-h-[52vh] overflow-hidden md:min-h-[68svh]"
    >
      <Image
        src="/assets/examples/accueil/eba-hero.webp"
        alt="Interieur chaleureux du coffee shop EBA a Abidjan"
        fill
        priority
        sizes="100vw"
        className="object-cover object-center"
      />

      <div
        aria-hidden="true"
        className="absolute inset-0 bg-linear-to-r from-black/80 via-black/58 to-black/35"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-linear-to-t from-black/55 via-transparent to-transparent"
      />

      <div className="content-container relative z-10 flex min-h-[52svh] items-end py-10 md:min-h-[68svh] md:py-16">
        <div className="grid w-full items-end gap-6 md:grid-cols-12 md:gap-8">
          <div className="md:col-span-7 lg:col-span-6">
            <span className="inline-flex rounded-full border border-white/35 bg-white/10 px-4 py-1 text-xs font-medium uppercase tracking-[0.22em] text-white/95 backdrop-blur-sm">
              Le lieu
            </span>

            <h1
              id="le-lieu-hero-title"
              className="mt-4 text-balance text-3xl font-semibold leading-tight text-white sm:text-4xl md:text-5xl"
            >
              Un cocon gourmand au coeur d&apos;Abidjan
            </h1>

            <p className="mt-4 max-w-2xl text-pretty text-sm leading-relaxed text-white/90 sm:text-base md:text-lg">
              Un espace chaleureux, soigne et convivial pour prendre un cafe,
              savourer une patisserie et ralentir un instant.
            </p>
          </div>

          <div className="hidden md:col-span-5 md:flex md:justify-end">
            <div className="max-w-sm rounded-2xl border border-white/20 bg-white/10 p-5 text-sm leading-relaxed text-white/85 shadow-2xl backdrop-blur-md">
              Une ambiance intime, des details soignes et une energie locale qui
              donne envie de rester.
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default HeroSection;
