import type { RefObject } from 'react';
import Image from 'next/image';

type PatissiereImageColumnProps = {
  /** Forwarded onto the wrapper used as ScrollTrigger trigger by the parent. */
  ref?: RefObject<HTMLDivElement | null>;
};

/**
 * Left-column visual composition: main portrait (parallaxed via
 * `data-main-image`), a secondary detail thumbnail, the floating credential
 * card with `data-stat-item` rows, and decorative corner accents. The
 * animations are wired by the parent section through data attributes and
 * the forwarded ref.
 */
function PatissiereImageColumn({ ref }: PatissiereImageColumnProps) {
  return (
    <div ref={ref} className="relative lg:sticky lg:top-24 lg:h-[78svh]">
      {/* Main portrait image */}
      <div className="relative h-80 overflow-hidden rounded-4xl shadow-2xl sm:h-104 lg:h-[calc(100%-5rem)]">
        <Image
          data-main-image
          src="/assets/examples/accueil/eba-hero-2.png"
          alt="La pâtissière d'EBA en pleine préparation dans son atelier"
          fill
          sizes="(max-width: 1024px) 100vw, 40vw"
          className="scale-105 object-cover object-center"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-linear-to-t from-black/50 via-black/10 to-transparent"
        />

        {/* Name & title overlay on image */}
        <div className="absolute bottom-0 left-0 right-0 z-10 p-5 sm:p-6">
          <div className="flex items-center gap-3">
            <div
              aria-hidden="true"
              className="h-8 w-0.5 rounded-full bg-secondary"
            />
            <div>
              <p className="text-sm font-semibold tracking-wide text-white sm:text-base">
                Fondatrice & Pâtissière
              </p>
              <p className="text-xs font-medium uppercase tracking-[0.15em] text-white/60">
                EBA Coffee Shop &middot; Abidjan
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Detail image — overlapping bottom-right */}
      <div
        data-detail-image
        className="absolute -bottom-2 -right-3 z-10 h-28 w-28 overflow-hidden rounded-2xl border-3 border-background shadow-xl sm:h-36 sm:w-36 lg:-right-5 lg:h-40 lg:w-40"
      >
        <Image
          src="/assets/examples/accueil/eba-hero.webp"
          alt="Détail d'une création pâtissière EBA"
          fill
          sizes="160px"
          className="object-cover object-center"
        />
      </div>

      {/* Credential card — floating left-bottom */}
      <div
        data-credential-card
        className="absolute -bottom-2 left-3 z-10 sm:left-4 lg:-left-3"
      >
        <div className="rounded-2xl border border-white/60 bg-white/80 px-4 py-4 shadow-lg shadow-black/5 backdrop-blur-md sm:px-5 sm:py-4.5">
          <div className="space-y-2.5">
            <div data-stat-item className="flex items-center gap-2.5">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/8">
                <span className="h-1.5 w-1.5 rounded-full bg-primary/60" />
              </span>
              <p className="text-xs font-medium text-foreground/70 sm:text-[0.8rem]">
                Formée en <span className="text-foreground/90">France</span>
              </p>
            </div>

            <div data-stat-item className="flex items-center gap-2.5">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-secondary/10">
                <span className="h-1.5 w-1.5 rounded-full bg-secondary/60" />
              </span>
              <p className="text-xs font-medium text-foreground/70 sm:text-[0.8rem]">
                CAP Pâtisserie{' '}
                <span className="text-foreground/50">&middot;</span>{' '}
                <span className="text-foreground/90">10+ ans</span>
              </p>
            </div>

            <div data-stat-item className="flex items-center gap-2.5">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/8">
                <span className="h-1.5 w-1.5 rounded-full bg-primary/60" />
              </span>
              <p className="text-xs font-medium text-foreground/70 sm:text-[0.8rem]">
                Savoir-faire{' '}
                <span className="text-foreground/90">artisanal</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Decorative corner accents */}
      <div
        aria-hidden="true"
        className="absolute -right-2.5 -top-2.5 h-16 w-16 rounded-br-3xl border-r-2 border-t-2 border-secondary/30"
      />
      <div
        aria-hidden="true"
        className="absolute -left-2.5 top-8 h-12 w-12 rounded-tl-2xl border-l-2 border-t-2 border-primary/20"
      />
    </div>
  );
}

export default PatissiereImageColumn;
