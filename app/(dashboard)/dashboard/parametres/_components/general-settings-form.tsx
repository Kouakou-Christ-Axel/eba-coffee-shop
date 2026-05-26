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

export function GeneralSettingsForm({ settings, onUpdate }: Props) {
  return (
    <section className="space-y-4 rounded-lg border bg-card p-5">
      <div>
        <h2 className="font-semibold">Réglages généraux</h2>
        <p className="text-xs text-muted-foreground">
          S&apos;applique à tous les créneaux générés.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="slotInterval">Intervalle de créneaux (min)</Label>
          <Input
            id="slotInterval"
            type="number"
            min={5}
            max={60}
            value={settings.slotIntervalMin}
            onChange={(e) =>
              onUpdate('slotIntervalMin', Number(e.target.value))
            }
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="leadTime">Délai minimum avant retrait (min)</Label>
          <Input
            id="leadTime"
            type="number"
            min={0}
            max={1440}
            value={settings.leadTimeMin}
            onChange={(e) => onUpdate('leadTimeMin', Number(e.target.value))}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="visibleDays">Jours visibles côté client</Label>
          <Input
            id="visibleDays"
            type="number"
            min={1}
            max={14}
            value={settings.visibleDays}
            onChange={(e) => onUpdate('visibleDays', Number(e.target.value))}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="capacity">
            Capacité max par créneau (vide = illimité)
          </Label>
          <Input
            id="capacity"
            type="number"
            min={1}
            value={settings.capacityPerSlot ?? ''}
            onChange={(e) =>
              onUpdate(
                'capacityPerSlot',
                e.target.value === '' ? null : Number(e.target.value)
              )
            }
          />
        </div>
      </div>
    </section>
  );
}
