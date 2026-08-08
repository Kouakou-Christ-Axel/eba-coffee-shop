'use client';

import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

export type TiktokVideoFormValues = {
  url: string;
  caption: string;
  isActive: boolean;
};

export const emptyTiktokVideoValues: TiktokVideoFormValues = {
  url: '',
  caption: '',
  isActive: true,
};

/** Champs communs à la création et à l'édition d'une vidéo TikTok embarquée.
 * Réutilisé par `tiktok-table.tsx` (création) et `edit-tiktok-sheet.tsx`
 * (édition). */
export function TiktokVideoFormFields({
  values,
  onChange,
  idPrefix = 'tiktok',
}: {
  values: TiktokVideoFormValues;
  onChange: (v: TiktokVideoFormValues) => void;
  idPrefix?: string;
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-url`}>URL de la vidéo TikTok</Label>
        <Input
          id={`${idPrefix}-url`}
          value={values.url}
          onChange={(e) => onChange({ ...values, url: e.target.value })}
          placeholder="https://www.tiktok.com/@compte/video/1234567890123456789"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-caption`}>Légende (optionnel)</Label>
        <Textarea
          id={`${idPrefix}-caption`}
          value={values.caption}
          onChange={(e) => onChange({ ...values, caption: e.target.value })}
          placeholder="Surtitre affiché au-dessus de la vidéo sur le site…"
        />
      </div>

      <div className="flex items-center justify-between rounded-md border p-3">
        <div>
          <p className="text-sm font-medium">Vidéo active</p>
          <p className="text-xs text-muted-foreground">
            Affichée dans la section « Suivez l’aventure » de l’accueil.
          </p>
        </div>
        <Switch
          checked={values.isActive}
          onCheckedChange={(checked) =>
            onChange({ ...values, isActive: checked })
          }
        />
      </div>
    </div>
  );
}
