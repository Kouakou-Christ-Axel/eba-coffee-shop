'use client';

import { useState, useTransition } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Trash2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { createProductAction, updateProductAction } from '../../actions';

const BADGE_OPTIONS = ['Best-seller', 'Coup de cœur', 'Nouveau'] as const;

type SupplementOption = { name: string; price: number };
type SupplementGroup = {
  name: string;
  type: 'single' | 'multiple';
  required: boolean;
  options: SupplementOption[];
};

export type ProductFormInitial = {
  id?: string;
  name: string;
  description: string;
  price: number;
  imageUrl: string | null;
  supplementGroups: SupplementGroup[];
  featured: boolean;
  featuredOrder: number;
  featuredBadge: string | null;
};

const EMPTY: ProductFormInitial = {
  name: '',
  description: '',
  price: 0,
  imageUrl: null,
  supplementGroups: [],
  featured: false,
  featuredOrder: 0,
  featuredBadge: null,
};

export function ProductForm({
  categoryId,
  initial,
}: {
  categoryId: string;
  initial?: ProductFormInitial;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const [name, setName] = useState(initial?.name ?? EMPTY.name);
  const [description, setDescription] = useState(
    initial?.description ?? EMPTY.description
  );
  const [price, setPrice] = useState<number>(initial?.price ?? EMPTY.price);
  const [imageUrl, setImageUrl] = useState<string | null>(
    initial?.imageUrl ?? null
  );
  const [groups, setGroups] = useState<SupplementGroup[]>(
    initial?.supplementGroups ?? []
  );
  const [featured, setFeatured] = useState<boolean>(
    initial?.featured ?? EMPTY.featured
  );
  const [featuredOrder, setFeaturedOrder] = useState<number>(
    initial?.featuredOrder ?? EMPTY.featuredOrder
  );
  const [featuredBadge, setFeaturedBadge] = useState<string | null>(
    initial?.featuredBadge ?? EMPTY.featuredBadge
  );

  const isEdit = Boolean(initial?.id);

  async function handleFile(file: File) {
    setUploadError(null);
    setIsUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? `Erreur ${res.status}`);
      }
      const { url } = (await res.json()) as { url: string };
      setImageUrl(url);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Erreur upload');
    } finally {
      setIsUploading(false);
    }
  }

  function addGroup() {
    setGroups([
      ...groups,
      { name: '', type: 'single', required: false, options: [] },
    ]);
  }
  function removeGroup(gi: number) {
    setGroups(groups.filter((_, i) => i !== gi));
  }
  function updateGroup(gi: number, patch: Partial<SupplementGroup>) {
    setGroups(groups.map((g, i) => (i === gi ? { ...g, ...patch } : g)));
  }
  function addOption(gi: number) {
    updateGroup(gi, {
      options: [...groups[gi].options, { name: '', price: 0 }],
    });
  }
  function removeOption(gi: number, oi: number) {
    updateGroup(gi, {
      options: groups[gi].options.filter((_, i) => i !== oi),
    });
  }
  function updateOption(
    gi: number,
    oi: number,
    patch: Partial<SupplementOption>
  ) {
    updateGroup(gi, {
      options: groups[gi].options.map((o, i) =>
        i === oi ? { ...o, ...patch } : o
      ),
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    startTransition(async () => {
      try {
        const payload = {
          name: name.trim(),
          description: description.trim(),
          price: Number(price) || 0,
          imageUrl,
          supplementGroups: groups.map((g) => ({
            ...g,
            options: g.options.filter((o) => o.name.trim().length > 0),
          })),
          featured,
          featuredOrder: featured ? Number(featuredOrder) || 0 : 0,
          featuredBadge: featured ? featuredBadge : null,
        };
        if (isEdit && initial?.id) {
          await updateProductAction(initial.id, payload);
        } else {
          await createProductAction({ ...payload, categoryId });
        }
        router.push(`/dashboard/menu/${categoryId}`);
        router.refresh();
      } catch (err) {
        setSubmitError(err instanceof Error ? err.message : 'Erreur');
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Informations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">Nom</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="desc">Description</Label>
            <Textarea
              id="desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="price">Prix (FCFA)</Label>
            <Input
              id="price"
              type="number"
              min={0}
              step={100}
              value={price}
              onChange={(e) => setPrice(Number(e.target.value))}
              required
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Image</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {imageUrl && (
            <Image
              src={imageUrl}
              alt="Aperçu"
              width={160}
              height={160}
              className="size-40 rounded-md object-cover"
            />
          )}
          <Input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={isUploading}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
          />
          {isUploading && (
            <p className="text-xs text-muted-foreground">Upload en cours…</p>
          )}
          {uploadError && (
            <p className="text-xs text-destructive">{uploadError}</p>
          )}
          {imageUrl && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setImageUrl(null)}
            >
              Retirer l&apos;image
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Mise en avant sur la page d&apos;accueil</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="featured">
                Afficher dans les incontournables
              </Label>
              <p className="text-xs text-muted-foreground">
                Le produit apparaîtra dans la section &laquo;&nbsp;Ce qu&apos;on
                aime vous servir&nbsp;&raquo; de la page d&apos;accueil.
              </p>
            </div>
            <Switch
              id="featured"
              checked={featured}
              onCheckedChange={setFeatured}
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
                  onChange={(e) => setFeaturedOrder(Number(e.target.value))}
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
                    setFeaturedBadge(
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

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Groupes de suppléments</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addGroup}
            >
              <Plus className="mr-1 size-3" /> Ajouter un groupe
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {groups.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Aucun groupe de suppléments.
            </p>
          )}
          {groups.map((g, gi) => (
            <div key={gi} className="space-y-3 rounded-lg border p-4">
              <div className="flex items-end gap-2">
                <div className="flex-1 space-y-1.5">
                  <Label>Nom du groupe</Label>
                  <Input
                    value={g.name}
                    onChange={(e) => updateGroup(gi, { name: e.target.value })}
                    placeholder="ex: Choix du lait"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Type</Label>
                  <select
                    value={g.type}
                    onChange={(e) =>
                      updateGroup(gi, {
                        type: e.target.value as 'single' | 'multiple',
                      })
                    }
                    className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                  >
                    <option value="single">Choix unique</option>
                    <option value="multiple">Choix multiples</option>
                  </select>
                </div>
                <label className="flex h-9 items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={g.required}
                    onChange={(e) =>
                      updateGroup(gi, { required: e.target.checked })
                    }
                  />
                  Requis
                </label>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => removeGroup(gi)}
                  aria-label="Supprimer le groupe"
                >
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </div>

              <div className="space-y-2">
                <Label>Options</Label>
                {g.options.map((o, oi) => (
                  <div key={oi} className="flex items-center gap-2">
                    <Input
                      placeholder="Nom"
                      value={o.name}
                      onChange={(e) =>
                        updateOption(gi, oi, { name: e.target.value })
                      }
                    />
                    <Input
                      type="number"
                      placeholder="Prix"
                      min={0}
                      step={100}
                      value={o.price}
                      onChange={(e) =>
                        updateOption(gi, oi, {
                          price: Number(e.target.value),
                        })
                      }
                      className="w-32"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => removeOption(gi, oi)}
                      aria-label="Supprimer l'option"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => addOption(gi)}
                >
                  <Plus className="mr-1 size-3" /> Ajouter une option
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {submitError && <p className="text-sm text-destructive">{submitError}</p>}

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={isPending || isUploading}>
          {isPending
            ? 'Enregistrement…'
            : isEdit
              ? 'Enregistrer'
              : 'Créer le produit'}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push(`/dashboard/menu/${categoryId}`)}
          disabled={isPending}
        >
          Annuler
        </Button>
      </div>
    </form>
  );
}
