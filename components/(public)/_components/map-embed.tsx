'use client';

// components/(public)/_components/map-embed.tsx
//
// Façade de la carte Google Maps : on affiche un aperçu maison et on ne monte
// l'iframe `google.com/maps/embed` qu'au clic du visiteur.
//
// Pourquoi : cet iframe est de loin le plus gros poste de la page côté tiers —
// il tire à lui seul plusieurs centaines de kilo-octets de JS Google, une
// vingtaine de requêtes et du temps de thread principal, le tout AVANT que le
// visiteur ait manifesté le moindre intérêt pour la carte. `loading="lazy"` ne
// suffit pas : le seuil de déclenchement de Chrome est large (et nul sur une
// carte proche du haut de page comme /contact), et surtout un simple passage
// de scroll suffit à tout déclencher. Sur une connexion mobile ivoirienne, ça
// se paie directement en interactivité.
//
// Même patron que la façade TikTok (`accueil/_components/tiktok-embed-lazy`) :
// l'aperçu est un VRAI lien vers l'itinéraire Google Maps. Sans JS, ou sur un
// clic milieu / ctrl-clic, il ouvre Maps dans un onglet plutôt que de ne rien
// faire — la carte reste donc atteignable en toutes circonstances.

import { useState, type MouseEvent } from 'react';
import { MapPin } from 'lucide-react';

type MapEmbedProps = {
  /** URL `https://www.google.com/maps/embed?pb=…` (cf. ContactSettings.mapsEmbedUrl). */
  embedUrl: string;
  /** URL d'itinéraire, servie en repli par l'aperçu tant que l'iframe n'est pas monté. */
  directionsUrl: string;
  /** Titre accessible de l'iframe. */
  title: string;
  /** Libellé affiché sous le bouton d'ouverture (adresse, repère…). */
  caption?: string;
  /** Classes du conteneur — c'est lui qui porte la hauteur (`h-80`, `h-124`…). */
  className?: string;
};

export function MapEmbed({
  embedUrl,
  directionsUrl,
  title,
  caption,
  className,
}: MapEmbedProps) {
  const [isLoaded, setIsLoaded] = useState(false);

  if (isLoaded) {
    return (
      <div className={className}>
        <iframe
          title={title}
          src={embedUrl}
          referrerPolicy="no-referrer-when-downgrade"
          className="h-full w-full border-0"
        />
      </div>
    );
  }

  const load = (e: MouseEvent<HTMLAnchorElement>) => {
    // Laisse le navigateur faire son travail sur un clic « ouvrir ailleurs ».
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) {
      return;
    }
    e.preventDefault();
    setIsLoaded(true);
  };

  return (
    <div className={className}>
      <a
        href={directionsUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={load}
        aria-label={`${title} — afficher la carte`}
        className="group relative flex h-full w-full flex-col items-center justify-center gap-3 overflow-hidden bg-[linear-gradient(150deg,rgba(247,239,232,1)_0%,rgba(238,228,240,1)_100%)] px-6 text-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        {/* Trame décorative évoquant un plan, en CSS pur : aucune image, aucun
            octet réseau. Purement ornemental, donc masqué à l'assistance. */}
        <span
          aria-hidden="true"
          className="absolute inset-0 opacity-[0.18] [background-image:linear-gradient(to_right,rgba(108,48,119,0.35)_1px,transparent_1px),linear-gradient(to_bottom,rgba(108,48,119,0.35)_1px,transparent_1px)] [background-size:44px_44px]"
        />
        {/* Deux « axes » qui traversent la vignette. Placés en haut et en bas,
            jamais au centre : le libellé et l'adresse y vivent, et une bande
            derrière le texte le rendrait illisible. */}
        <span
          aria-hidden="true"
          className="absolute -inset-x-10 top-[18%] h-6 -rotate-6 bg-secondary/20"
        />
        <span
          aria-hidden="true"
          className="absolute -inset-x-10 bottom-[14%] h-4 rotate-3 bg-primary/10"
        />

        <span className="relative flex h-14 w-14 items-center justify-center rounded-full bg-background/90 shadow-md transition-transform group-hover:scale-105">
          <MapPin className="h-6 w-6 text-primary" aria-hidden="true" />
        </span>

        <span className="relative">
          <span className="block text-sm font-semibold text-foreground">
            Afficher la carte
          </span>
          {caption ? (
            <span className="mt-1 block text-xs text-foreground/65">
              {caption}
            </span>
          ) : null}
        </span>
      </a>
    </div>
  );
}

export default MapEmbed;
