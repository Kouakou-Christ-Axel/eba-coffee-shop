// components/(public)/carte/carte-hero-section.tsx
'use client';

import { Link } from '@heroui/react';
import { RecentOrdersLink } from '@/components/(public)/commande/recent-orders-link';

type Props = {
  menuPdfUrl: string | null;
};

// Hero volontairement court. Dans sa version précédente (pt-32/pt-40, titre en
// 5xl, sous-titre, bouton PDF plein, lien commandes empilés) il occupait tout
// le premier écran d'un téléphone : le client arrivait sur une carte sans voir
// un seul produit. Le PDF passe en lien discret — c'est une porte de sortie
// vers un fichier, pas l'action qu'on veut pousser sur une page de vente.
function CarteHeroSection({ menuPdfUrl }: Props) {
  return (
    <section
      aria-labelledby="carte-hero-title"
      className="bg-[linear-gradient(180deg,rgba(247,239,232,1)_0%,rgba(255,252,248,1)_100%)] pb-3 pt-24 md:pb-5 md:pt-32"
    >
      <div className="content-container">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-secondary-600">
            Notre carte
          </p>
          <h1
            id="carte-hero-title"
            className="mt-2 text-balance text-3xl font-semibold leading-snug tracking-tight sm:text-4xl"
          >
            Cafés & pâtisseries artisanales à Cocody
          </h1>
          <p className="mt-2.5 text-sm leading-relaxed text-foreground/60 sm:text-base">
            Chaque boisson et chaque pâtisserie est préparée sur place, chaque
            jour.
          </p>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5">
            {menuPdfUrl && (
              <Link
                href={menuPdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                size="sm"
                className="text-sm text-foreground/55 underline-offset-4 hover:text-primary hover:underline"
              >
                Télécharger la carte (PDF)
              </Link>
            )}
            {/* Visible seulement si l'appareil a déjà commandé. */}
            <RecentOrdersLink />
          </div>
        </div>
      </div>
    </section>
  );
}

export default CarteHeroSection;
