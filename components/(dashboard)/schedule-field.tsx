'use client';

import { useId } from 'react';
import Link from 'next/link';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export type ScheduleOption = { id: string; name: string };

export function ScheduleField({
  schedules,
  scheduleId,
  onChange,
  label = 'Planning récurrent',
  helpText = 'Restreint la commande aux jours du planning.',
  id,
}: {
  schedules: ScheduleOption[];
  scheduleId: string | null;
  onChange: (id: string | null) => void;
  label?: string;
  helpText?: string;
  /** Id du select. Généré si absent : plusieurs `ScheduleField` peuvent
   * cohabiter dans la même page (bloc de création + panneau d'édition). */
  id?: string;
}) {
  const generatedId = useId();
  const selectId = id ?? generatedId;

  return (
    <div className="space-y-1.5">
      <Label htmlFor={selectId}>{label}</Label>
      <Select
        value={scheduleId ?? 'none'}
        onValueChange={(value) => onChange(value === 'none' ? null : value)}
      >
        <SelectTrigger id={selectId} className="w-full">
          <SelectValue placeholder="Aucun (tous les jours)" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">Aucun (tous les jours)</SelectItem>
          {schedules.map((s) => (
            <SelectItem key={s.id} value={s.id}>
              {s.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground">
        {helpText} Gérer les plannings :{' '}
        <Link href="/dashboard/menu/plannings" className="underline">
          Plannings récurrents
        </Link>
        .
      </p>
    </div>
  );
}
