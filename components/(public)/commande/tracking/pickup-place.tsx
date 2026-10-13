import { MapPin } from 'lucide-react';
import { MapEmbed } from '@/components/(public)/_components/map-embed';

export function PickupPlace({
  pickupAddress,
  pickupMapsUrl,
}: {
  pickupAddress: string | null;
  pickupMapsUrl: string | null;
}) {
  return (
    <div className="w-full rounded-xl border border-foreground/10 bg-default-50 p-5">
      <div className="flex items-start gap-3">
        <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <div className="flex-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-foreground/40">
            Lieu de retrait
          </p>
          {pickupAddress && (
            <p className="mt-1 text-sm font-medium">{pickupAddress}</p>
          )}
          <p className="mt-1 text-xs text-foreground/60">
            Ton livreur peut estimer le coût de la course avec la localisation
            ci-dessous.
          </p>
        </div>
      </div>
      {pickupMapsUrl &&
        (pickupMapsUrl.includes('/maps/embed') ? (
          <MapEmbed
            embedUrl={pickupMapsUrl}
            // Un lien `/maps/embed` n'est pas destiné à être ouvert tel
            // quel : le repli hors-iframe pointe donc sur une recherche
            // Maps de l'adresse quand on en a une.
            directionsUrl={
              pickupAddress
                ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(pickupAddress)}`
                : pickupMapsUrl
            }
            title="Carte du lieu de retrait"
            caption={pickupAddress ?? undefined}
            className="mt-4 h-55 overflow-hidden rounded-lg border border-foreground/10"
          />
        ) : (
          <a
            href={pickupMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-block py-2 text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            Voir sur Google Maps →
          </a>
        ))}
    </div>
  );
}
