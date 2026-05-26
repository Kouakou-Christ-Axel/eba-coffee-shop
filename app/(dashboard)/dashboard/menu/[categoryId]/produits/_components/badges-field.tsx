'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export const BADGE_OPTIONS = [
  'Best-seller',
  'Coup de cœur',
  'Nouveau',
] as const;

type Props = {
  featured: boolean;
  featuredOrder: number;
  featuredBadge: string | null;
  onFeaturedChange: (value: boolean) => void;
  onFeaturedOrderChange: (value: number) => void;
  onFeaturedBadgeChange: (value: string | null) => void;
};

export function BadgesField({
  featured,
  featuredOrder,
  featuredBadge,
  onFeaturedChange,
  onFeaturedOrderChange,
  onFeaturedBadgeChange,
}: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Mise en avant sur la page d&apos;accueil</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="featured">Afficher dans les incontournables</Label>
            <p className="text-xs text-muted-foreground">
              Le produit apparaîtra dans la section &laquo;&nbsp;Ce qu&apos;on
              aime vous servir&nbsp;&raquo; de la page d&apos;accueil.
            </p>
          </div>
          <Switch
            id="featured"
            checked={featured}
            onCheckedChange={onFeaturedChange}
          />
        </div>

        {featured && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="featuredOrder">Ordre d&apos;affichage</Label>
              <Input
                id="featuredOrder"
                type="number"
                min={0}
                step={1}
                value={featuredOrder}
                onChange={(e) => onFeaturedOrderChange(Number(e.target.value))}
              />
              <p className="text-xs text-muted-foreground">
                Plus petit = affiché en premier.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="featuredBadge">Badge</Label>
              <select
                id="featuredBadge"
                value={featuredBadge ?? ''}
                onChange={(e) =>
                  onFeaturedBadgeChange(
                    e.target.value === '' ? null : e.target.value
                  )
                }
                className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              >
                <option value="">Aucun</option>
                {BADGE_OPTIONS.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
