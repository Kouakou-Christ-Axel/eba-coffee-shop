'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { PickupSettings } from '@/lib/pickup-settings';

type Props = {
  settings: PickupSettings;
  onUpdate: <K extends keyof PickupSettings>(
    key: K,
    value: PickupSettings[K]
  ) => void;
};

export function PickupLocationForm({ settings, onUpdate }: Props) {
  return (
    <section className="space-y-4 rounded-lg border bg-card p-5">
      <div>
        <h2 className="font-semibold">Lieu de retrait</h2>
        <p className="text-xs text-muted-foreground">
          Affiché au client sur la page de confirmation de commande.
        </p>
      </div>
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="pickupAddress">Adresse</Label>
          <Input
            id="pickupAddress"
            type="text"
            maxLength={200}
            placeholder="Boulevard Latrille, Cocody, Abidjan"
            value={settings.pickupAddress ?? ''}
            onChange={(e) =>
              onUpdate(
                'pickupAddress',
                e.target.value === '' ? null : e.target.value
              )
            }
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pickupMapsUrl">Lien Google Maps</Label>
          <Input
            id="pickupMapsUrl"
            type="url"
            maxLength={500}
            placeholder="https://www.google.com/maps/embed?pb=... ou https://maps.google.com/?q=..."
            value={settings.pickupMapsUrl ?? ''}
            onChange={(e) =>
              onUpdate(
                'pickupMapsUrl',
                e.target.value === '' ? null : e.target.value
              )
            }
          />
          <p className="text-xs text-muted-foreground">
            Une URL d&apos;intégration <code>/maps/embed</code> sera affichée
            comme une carte intégrée. Toute autre URL apparaîtra comme un lien.
          </p>
        </div>
      </div>
    </section>
  );
}
