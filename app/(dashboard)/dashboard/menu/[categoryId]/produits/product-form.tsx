'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  createProductAction,
  updateProductAction,
  pauseProductAction,
  resumeProductAction,
} from '../../actions';
import { ProductImagesField } from './_components/product-images-field';
import { BadgesField } from './_components/badges-field';
import {
  SupplementsEditor,
  type SupplementGroup,
} from './_components/supplements-editor';
import {
  abidjanDatetimeLocalToISO,
  formatAbidjanDateTime,
} from '@/lib/timezone';
import { isPausedNow } from '@/lib/supplements';

export type ProductFormInitial = {
  id?: string;
  name: string;
  description: string;
  price: number;
  coutMatiere: number;
  coutEmballage: number;
  imageUrl: string | null;
  supplementGroups: SupplementGroup[];
  featured: boolean;
  featuredOrder: number;
  featuredBadge: string | null;
  stockQuantity: number | null;
  unavailableUntil: Date | null;
};

const EMPTY: ProductFormInitial = {
  name: '',
  description: '',
  price: 0,
  coutMatiere: 0,
  coutEmballage: 0,
  imageUrl: null,
  supplementGroups: [],
  featured: false,
  featuredOrder: 0,
  featuredBadge: null,
  stockQuantity: null,
  unavailableUntil: null,
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
  const [price, setPrice] = useState<string>(
    String(initial?.price ?? EMPTY.price)
  );
  const [coutMatiere, setCoutMatiere] = useState<string>(
    String(initial?.coutMatiere ?? EMPTY.coutMatiere)
  );
  const [coutEmballage, setCoutEmballage] = useState<string>(
    String(initial?.coutEmballage ?? EMPTY.coutEmballage)
  );
  const priceNum = Number(price) || 0;
  const coutMatiereNum = Number(coutMatiere) || 0;
  const coutEmballageNum = Number(coutEmballage) || 0;
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
  const [stockQuantity, setStockQuantity] = useState<number | null>(
    initial?.stockQuantity ?? EMPTY.stockQuantity
  );

  // Pause programmée : gérée indépendamment de la sauvegarde du formulaire
  // (appelle directement `pauseProductAction`/`resumeProductAction`, qui
  // agissent sur le produit persisté). Non disponible pour un produit non
  // encore créé (pas d'id).
  const [unavailableUntil, setUnavailableUntil] = useState<Date | null>(
    initial?.unavailableUntil ?? null
  );
  const [pauseCustomInput, setPauseCustomInput] = useState('');
  const [isPausePending, startPauseTransition] = useTransition();
  const [pauseError, setPauseError] = useState<string | null>(null);

  const isEdit = Boolean(initial?.id);
  const isPausedNowValue = isPausedNow(unavailableUntil);

  function applyPause(until: Date) {
    if (!initial?.id) return;
    setPauseError(null);
    startPauseTransition(async () => {
      try {
        await pauseProductAction(initial.id!, until.toISOString());
        setUnavailableUntil(until);
        router.refresh();
      } catch (err) {
        setPauseError(err instanceof Error ? err.message : 'Erreur');
      }
    });
  }

  function handlePauseHours(hours: number) {
    applyPause(new Date(Date.now() + hours * 60 * 60 * 1000));
  }

  function handlePauseCustom() {
    const iso = abidjanDatetimeLocalToISO(pauseCustomInput);
    if (!iso) {
      setPauseError('Date/heure invalide');
      return;
    }
    const until = new Date(iso);
    if (until.getTime() <= Date.now()) {
      setPauseError('La reprise doit être dans le futur');
      return;
    }
    applyPause(until);
  }

  function handleResume() {
    if (!initial?.id) return;
    setPauseError(null);
    startPauseTransition(async () => {
      try {
        await resumeProductAction(initial.id!);
        setUnavailableUntil(null);
        setPauseCustomInput('');
        router.refresh();
      } catch (err) {
        setPauseError(err instanceof Error ? err.message : 'Erreur');
      }
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
          price: priceNum,
          coutMatiere: coutMatiereNum,
          coutEmballage: coutEmballageNum,
          imageUrl,
          supplementGroups: groups.map((g) => ({
            ...g,
            options: g.options.filter((o) => o.name.trim().length > 0),
          })),
          featured,
          featuredOrder: featured ? Number(featuredOrder) || 0 : 0,
          featuredBadge: featured ? featuredBadge : null,
          stockQuantity,
        };
        const result =
          isEdit && initial?.id
            ? await updateProductAction(initial.id, payload)
            : await createProductAction({ ...payload, categoryId });
        if (result?.error) {
          setSubmitError(result.error);
          return;
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
            <Label htmlFor="price">Prix de vente (FCFA)</Label>
            <Input
              id="price"
              type="number"
              min={0}
              step={1}
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="cout-matiere">Coût matière (FCFA)</Label>
              <Input
                id="cout-matiere"
                type="number"
                min={0}
                step={1}
                value={coutMatiere}
                onChange={(e) => setCoutMatiere(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cout-emballage">Coût emballage (FCFA)</Label>
              <Input
                id="cout-emballage"
                type="number"
                min={0}
                step={1}
                value={coutEmballage}
                onChange={(e) => setCoutEmballage(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="stock-quantity">Quantité disponible du jour</Label>
            <Input
              id="stock-quantity"
              type="number"
              min={0}
              step={1}
              placeholder="Illimité"
              value={stockQuantity ?? ''}
              onChange={(e) =>
                setStockQuantity(
                  e.target.value === '' ? null : Number(e.target.value)
                )
              }
            />
            <p className="text-xs text-muted-foreground">
              Vide = illimité (crêpes, boissons…). Un nombre = suivi et
              décrémenté au paiement.
            </p>
          </div>
          {priceNum > 0 && (
            <div className="rounded-lg bg-muted px-3 py-2 text-sm">
              <span className="text-muted-foreground">Marge estimée : </span>
              <span className="font-semibold">
                {new Intl.NumberFormat('fr-FR').format(
                  priceNum - coutMatiereNum - coutEmballageNum
                )}{' '}
                FCFA
              </span>
              <span className="ml-2 text-muted-foreground">
                (
                {Math.round(
                  ((priceNum - coutMatiereNum - coutEmballageNum) /
                    priceNum) *
                    100
                )}{' '}
                %)
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {isEdit && (
        <Card>
          <CardHeader>
            <CardTitle>Pause programmée</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm">
              {isPausedNowValue && unavailableUntil ? (
                <span className="font-medium text-amber-600">
                  En pause jusqu&apos;au{' '}
                  {formatAbidjanDateTime(unavailableUntil)}
                </span>
              ) : (
                <span className="text-muted-foreground">
                  Disponible (pas de pause en cours).
                </span>
              )}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isPausePending}
                onClick={() => handlePauseHours(1)}
              >
                +1h
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isPausePending}
                onClick={() => handlePauseHours(2)}
              >
                +2h
              </Button>
              <Input
                type="datetime-local"
                value={pauseCustomInput}
                onChange={(e) => setPauseCustomInput(e.target.value)}
                className="w-auto"
                aria-label="Reprise programmée à une date/heure précise"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isPausePending || !pauseCustomInput}
                onClick={handlePauseCustom}
              >
                Programmer
              </Button>
              {isPausedNowValue && (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={isPausePending}
                  onClick={handleResume}
                >
                  Remettre disponible
                </Button>
              )}
            </div>
            {pauseError && (
              <p className="text-sm text-destructive">{pauseError}</p>
            )}
          </CardContent>
        </Card>
      )}

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
