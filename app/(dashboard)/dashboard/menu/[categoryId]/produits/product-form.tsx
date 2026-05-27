'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { createProductAction, updateProductAction } from '../../actions';
import { ProductImagesField } from './_components/product-images-field';
import { BadgesField } from './_components/badges-field';
import {
  SupplementsEditor,
  type SupplementGroup,
} from './_components/supplements-editor';

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

      <ProductImagesField
        imageUrl={imageUrl}
        isUploading={isUploading}
        onUploadStart={() => setIsUploading(true)}
        onUploadEnd={() => setIsUploading(false)}
        onUploaded={setImageUrl}
        onRemove={() => setImageUrl(null)}
      />

      <BadgesField
        featured={featured}
        featuredOrder={featuredOrder}
        featuredBadge={featuredBadge}
        onFeaturedChange={setFeatured}
        onFeaturedOrderChange={setFeaturedOrder}
        onFeaturedBadgeChange={setFeaturedBadge}
      />

      <SupplementsEditor groups={groups} onChange={setGroups} />

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
