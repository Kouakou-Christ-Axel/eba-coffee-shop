// components/(public)/carte/carte-hero-section.tsx

function CarteHeroSection() {
  return (
    <section
      aria-labelledby="carte-hero-title"
      className="bg-[linear-gradient(180deg,rgba(247,239,232,1)_0%,rgba(255,252,248,1)_100%)] pb-4 pt-32 md:pb-6 md:pt-40"
    >
      <div className="content-container">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-secondary-600">
            Notre carte
          </p>
          <h1
            id="carte-hero-title"
            className="mt-3 text-balance text-4xl font-semibold leading-snug tracking-tight sm:text-5xl"
          >
            Des saveurs pensées avec soin
          </h1>
          <p className="mt-4 text-base leading-relaxed text-foreground/60 sm:text-lg">
            Chaque boisson et chaque pâtisserie est préparée sur place, chaque
            jour.
          </p>
        </div>
      </div>
    </section>
  );
}

export default CarteHeroSection;
