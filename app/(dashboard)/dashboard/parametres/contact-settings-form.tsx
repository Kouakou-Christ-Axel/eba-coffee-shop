'use client';

import { useState, useTransition } from 'react';
import { Loader2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ContactSettings } from '@/lib/contact-settings';
import { saveContactSettings } from './actions';

export function ContactSettingsForm({ initial }: { initial: ContactSettings }) {
  const [s, setS] = useState<ContactSettings>(initial);
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{
    kind: 'success' | 'error';
    msg: string;
  } | null>(null);

  function set<K extends keyof ContactSettings>(key: K, value: string) {
    setS((prev) => ({ ...prev, [key]: value }));
  }

  function save() {
    setFeedback(null);
    startTransition(async () => {
      const r = await saveContactSettings(s);
      setFeedback(
        r.ok
          ? { kind: 'success', msg: 'Coordonnées enregistrées.' }
          : { kind: 'error', msg: r.error }
      );
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Coordonnées du commerce</CardTitle>
        <p className="text-xs text-muted-foreground">
          Les horaires affichés publiquement reprennent ceux du bloc « Horaires
          » ci-dessus (retrait) — rien à saisir ici.
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field
            id="address"
            label="Adresse"
            value={s.address}
            onChange={(v) => set('address', v)}
          />
          <Field
            id="district"
            label="Quartier"
            value={s.district}
            onChange={(v) => set('district', v)}
          />
          <Field
            id="landmark"
            label="Repère"
            value={s.landmark}
            onChange={(v) => set('landmark', v)}
          />
          <Field
            id="phone"
            label="Téléphone"
            value={s.phone}
            onChange={(v) => set('phone', v)}
          />
          <Field
            id="whatsapp"
            label="WhatsApp Business"
            value={s.whatsapp}
            onChange={(v) => set('whatsapp', v)}
          />
          <Field
            id="email"
            label="Email"
            type="email"
            value={s.email}
            onChange={(v) => set('email', v)}
          />
          <Field
            id="mapsDirectionsUrl"
            label="Lien Google Maps (itinéraire)"
            type="url"
            value={s.mapsDirectionsUrl}
            onChange={(v) => set('mapsDirectionsUrl', v)}
          />
          <Field
            id="mapsEmbedUrl"
            label="Lien Google Maps (carte embarquée)"
            type="url"
            value={s.mapsEmbedUrl}
            onChange={(v) => set('mapsEmbedUrl', v)}
          />
        </div>

        <div className="grid grid-cols-1 gap-3 border-t pt-4 sm:grid-cols-2">
          <Field
            id="instagramHandle"
            label="Instagram (pseudo)"
            value={s.instagramHandle}
            onChange={(v) => set('instagramHandle', v)}
          />
          <Field
            id="instagramUrl"
            label="Instagram (lien)"
            type="url"
            value={s.instagramUrl}
            onChange={(v) => set('instagramUrl', v)}
          />
          <Field
            id="tiktokHandle"
            label="TikTok (pseudo)"
            value={s.tiktokHandle}
            onChange={(v) => set('tiktokHandle', v)}
          />
          <Field
            id="tiktokUrl"
            label="TikTok (lien)"
            type="url"
            value={s.tiktokUrl}
            onChange={(v) => set('tiktokUrl', v)}
          />
          <Field
            id="hashtagLabel"
            label="Hashtag"
            value={s.hashtagLabel}
            onChange={(v) => set('hashtagLabel', v)}
          />
          <Field
            id="hashtagUrl"
            label="Hashtag (lien)"
            type="url"
            value={s.hashtagUrl}
            onChange={(v) => set('hashtagUrl', v)}
          />
        </div>

        {feedback && (
          <p
            className={
              feedback.kind === 'success'
                ? 'text-sm text-green-600'
                : 'text-sm text-destructive'
            }
          >
            {feedback.msg}
          </p>
        )}

        <Button onClick={save} disabled={pending}>
          {pending ? (
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-1.5 h-4 w-4" />
          )}
          Enregistrer
        </Button>
      </CardContent>
    </Card>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  type = 'text',
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
