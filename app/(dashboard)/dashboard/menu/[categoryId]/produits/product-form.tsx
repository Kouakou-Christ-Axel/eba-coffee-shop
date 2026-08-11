'use client';

// Fiche produit — création et édition.
//
// La fiche portait autrefois huit blocs empilés sur une seule colonne (jusqu'à
// ~2 500 px de haut en édition), ce qui rendait le bouton « Enregistrer »
// invisible et noyait les champs vraiment obligatoires. Elle est désormais
// découpée en onglets, avec une barre d'action collante toujours visible.
//
// Conséquence directe de ce découpage : la validation HTML native (`required`)
// n'est plus utilisable — un champ obligatoire situé dans un onglet masqué
// bloque la soumission SANS message visible (« invalid control is not
// focusable »). La validation est donc faite en JS, et l'onglet fautif est
// ouvert automatiquement.

import { useEffect, useMemo, useState, useTransition } from 'react';
import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ConfirmDialog } from '@/components/(dashboard)/confirm-dialog';
import { useUndoToast } from '@/lib/hooks/use-undo-toast';
import { createProductAction, updateProductAction } from '../../actions';
import { ProductImagesField } from './_components/product-images-field';
import { BadgesField } from './_components/badges-field';
import { PauseField } from './_components/pause-field';
import {
  ScheduleField,
  type ScheduleOption,
} from '@/components/(dashboard)/schedule-field';
import {
  WeeklySpecialField,
  type WeeklySpecialRow,
} from './_components/weekly-special-field';
import {
  SupplementsEditor,
  type SupplementGroup,
} from '@/components/(dashboard)/supplements-editor';
import {
  pruneSupplementGroups,
  validateSupplementGroups,
} from '@/lib/supplements-form';
import { ADVANCE_ORDER_DAYS_MAX } from '@/config/constants';

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
  scheduleId: string | null;
  // Délai de commande à l'avance (jours, brut — voir `Product.advanceOrderDays`,
  // prisma/schema.prisma). `null` = pas de contrainte propre à ce produit.
  advanceOrderDays: number | null;
  weeklySpecials: WeeklySpecialRow[];
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
  scheduleId: null,
  advanceOrderDays: null,
  weeklySpecials: [],
};

const TAB_VALUES = [
  'essentiel',
  'couts',
  'disponibilite',
  'supplements',
  'mise-en-avant',
  'stats',
] as const;
type TabValue = (typeof TAB_VALUES)[number];

// Champs validés côté client, dans l'ordre où l'onglet fautif est choisi.
const VALIDATED_FIELDS = [
  'name',
  'description',
  'price',
  'coutMatiere',
  'coutEmballage',
] as const;
type ValidatedField = (typeof VALIDATED_FIELDS)[number];
type FieldErrors = Partial<Record<ValidatedField, string>>;

const FIELD_TAB: Record<ValidatedField, TabValue> = {
  name: 'essentiel',
  description: 'essentiel',
  price: 'essentiel',
  coutMatiere: 'couts',
  coutEmballage: 'couts',
};

const priceFormatter = new Intl.NumberFormat('fr-FR');

/** Entier positif saisi dans un `<input type="number">`, ou `null` si invalide. */
function parseAmount(raw: string): number | null {
  if (raw.trim() === '') return null;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 ? n : null;
}

export function ProductForm({
  categoryId,
  initial,
  schedules,
  defaultTab,
  statsSlot,
}: {
  categoryId: string;
  initial?: ProductFormInitial;
  schedules: ScheduleOption[];
  /** Onglet initial, lu dans l'URL (`?onglet=`) par la page. */
  defaultTab?: string;
  /**
   * Contenu de l'onglet « Statistiques », rendu côté serveur et passé en prop.
   * Absent en création : un produit qui n'existe pas n'a rien vendu.
   */
  statsSlot?: ReactNode;
}) {
  const router = useRouter();
  const { pushToast } = useUndoToast();
  const [isPending, startTransition] = useTransition();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [confirmLeave, setConfirmLeave] = useState(false);

  const [tab, setTab] = useState<TabValue>(() =>
    TAB_VALUES.includes(defaultTab as TabValue) &&
    (defaultTab !== 'stats' || statsSlot)
      ? (defaultTab as TabValue)
      : 'essentiel'
  );

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
  const [scheduleId, setScheduleId] = useState<string | null>(
    initial?.scheduleId ?? EMPTY.scheduleId
  );
  const [advanceOrderDays, setAdvanceOrderDays] = useState<number | null>(
    initial?.advanceOrderDays ?? EMPTY.advanceOrderDays
  );

  const priceNum = parseAmount(price) ?? 0;
  const coutMatiereNum = parseAmount(coutMatiere) ?? 0;
  const coutEmballageNum = parseAmount(coutEmballage) ?? 0;
  const isEdit = Boolean(initial?.id);

  // Marqueur « modifications non enregistrées » : compare l'état courant à
  // l'état initial. Ne couvre QUE les champs du payload — la pause et les
  // semaines spéciales s'enregistrent d'elles-mêmes.
  const snapshot = JSON.stringify({
    name,
    description,
    price: priceNum,
    coutMatiere: coutMatiereNum,
    coutEmballage: coutEmballageNum,
    imageUrl,
    groups,
    featured,
    featuredOrder,
    featuredBadge,
    stockQuantity,
    scheduleId,
    advanceOrderDays,
  });
  const initialSnapshot = useMemo(
    () =>
      JSON.stringify({
        name: initial?.name ?? EMPTY.name,
        description: initial?.description ?? EMPTY.description,
        price: initial?.price ?? EMPTY.price,
        coutMatiere: initial?.coutMatiere ?? EMPTY.coutMatiere,
        coutEmballage: initial?.coutEmballage ?? EMPTY.coutEmballage,
        imageUrl: initial?.imageUrl ?? null,
        groups: initial?.supplementGroups ?? [],
        featured: initial?.featured ?? EMPTY.featured,
        featuredOrder: initial?.featuredOrder ?? EMPTY.featuredOrder,
        featuredBadge: initial?.featuredBadge ?? EMPTY.featuredBadge,
        stockQuantity: initial?.stockQuantity ?? EMPTY.stockQuantity,
        scheduleId: initial?.scheduleId ?? EMPTY.scheduleId,
        advanceOrderDays: initial?.advanceOrderDays ?? EMPTY.advanceOrderDays,
      }),
    [initial]
  );
  const isDirty = snapshot !== initialSnapshot;

  // Recalculées à chaque frappe, mais affichées seulement après une première
  // tentative d'enregistrement : les messages s'effacent alors au fil des
  // corrections, sans qu'il faille re-soumettre pour le vérifier.
  const supplementIssues = useMemo(
    () => validateSupplementGroups(groups),
    [groups]
  );
  const [showSupplementErrors, setShowSupplementErrors] = useState(false);

  // Garde-fou fermeture d'onglet / rechargement. Le formulaire est long et
  // désormais réparti sur plusieurs onglets : une saisie perdue ne se voit pas.
  useEffect(() => {
    if (!isDirty || isPending) return;
    function onBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
    }
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [isDirty, isPending]);

  function changeTab(value: string) {
    const next = value as TabValue;
    setTab(next);
    // Onglet reflété dans l'URL : un rechargement (ou le filtre de dates de
    // l'onglet Statistiques, qui repasse par le serveur) revient au même
    // endroit, et l'onglet se partage par lien.
    const url = new URL(window.location.href);
    url.searchParams.set('onglet', next);
    window.history.replaceState(null, '', url);
  }

  function validate(): FieldErrors {
    const next: FieldErrors = {};
    if (name.trim().length === 0) next.name = 'Le nom est obligatoire.';
    else if (name.trim().length > 120)
      next.name = 'Nom trop long (max 120 caractères).';

    if (description.trim().length === 0)
      next.description = 'La description est obligatoire.';
    else if (description.trim().length > 500)
      next.description = 'Description trop longue (max 500 caractères).';

    if (parseAmount(price) === null)
      next.price = 'Indiquez un prix entier, en francs CFA (0 minimum).';
    if (parseAmount(coutMatiere) === null)
      next.coutMatiere = 'Coût invalide (entier, 0 minimum).';
    if (parseAmount(coutEmballage) === null)
      next.coutEmballage = 'Coût invalide (entier, 0 minimum).';

    return next;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);

    const found = validate();
    setErrors(found);
    const firstField = VALIDATED_FIELDS.find((f) => found[f]);
    if (firstField) {
      changeTab(FIELD_TAB[firstField]);
      pushToast('Corrigez les champs signalés avant d’enregistrer.', 'error');
      return;
    }

    // Les suppléments sont validés à part : le repli serveur agrège tous ses
    // messages Zod en une seule chaîne affichée en bas de page, sans dire quel
    // groupe est en cause. Ici on sait le rattacher.
    if (supplementIssues.size > 0) {
      setShowSupplementErrors(true);
      changeTab('supplements');
      pushToast(
        'Corrigez les suppléments signalés avant d’enregistrer.',
        'error'
      );
      return;
    }

    startTransition(async () => {
      const payload = {
        name: name.trim(),
        description: description.trim(),
        price: priceNum,
        coutMatiere: coutMatiereNum,
        coutEmballage: coutEmballageNum,
        imageUrl,
        supplementGroups: pruneSupplementGroups(groups),
        featured,
        featuredOrder: featured ? Number(featuredOrder) || 0 : 0,
        featuredBadge: featured ? featuredBadge : null,
        stockQuantity,
        scheduleId,
        advanceOrderDays,
      };
      const result =
        isEdit && initial?.id
          ? await updateProductAction(initial.id, payload)
          : await createProductAction({ ...payload, categoryId });
      if (!result.ok) {
        setSubmitError(result.error);
        pushToast(result.error, 'error');
        return;
      }
      router.push(`/dashboard/menu/${categoryId}`);
      router.refresh();
      pushToast(isEdit ? `${payload.name} enregistré` : `${payload.name} créé`);
    });
  }

  function leave() {
    router.push(`/dashboard/menu/${categoryId}`);
  }

  function handleCancel() {
    if (isDirty) {
      setConfirmLeave(true);
      return;
    }
    leave();
  }

  const errorTabs = new Set(
    VALIDATED_FIELDS.filter((f) => errors[f]).map((f) => FIELD_TAB[f])
  );

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Tabs value={tab} onValueChange={changeTab}>
          {/* La barre passe à la ligne au lieu de défiler : six onglets ne
              tiennent pas sur une ligne étroite, et un defilement horizontal
              sans barre visible (les navigateurs la masquent au repos) donne
              exactement l'impression que les onglets manquent.
              La hauteur doit être levée, sinon `tabsListVariants` garde son
              `h-9` fixe et rogne la deuxième ligne. L'override reprend le
              MÊME variant que la base : un `h-auto` nu ne serait pas fusionné
              par `tailwind-merge` (modificateurs différents = groupes
              différents) et perdrait à l'ordre de la feuille de style. */}
          <TabsList className="max-w-full flex-wrap group-data-[orientation=horizontal]/tabs:h-auto">
            <TabTrigger value="essentiel" hasError={errorTabs.has('essentiel')}>
              Essentiel
            </TabTrigger>
            <TabTrigger value="couts" hasError={errorTabs.has('couts')}>
              Coûts &amp; stock
            </TabTrigger>
            <TabTrigger value="disponibilite" hasError={false}>
              Disponibilité
            </TabTrigger>
            <TabTrigger
              value="supplements"
              hasError={showSupplementErrors && supplementIssues.size > 0}
            >
              Suppléments
              {groups.length > 0 && (
                <span className="text-muted-foreground">({groups.length})</span>
              )}
            </TabTrigger>
            <TabTrigger value="mise-en-avant" hasError={false}>
              Mise en avant
            </TabTrigger>
            {statsSlot && (
              <TabTrigger value="stats" hasError={false}>
                Statistiques
              </TabTrigger>
            )}
          </TabsList>

          <TabsContent value="essentiel" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Identité du produit</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Field
                  id="name"
                  label="Nom"
                  error={errors.name}
                  hint={`${name.trim().length}/120`}
                >
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    aria-invalid={Boolean(errors.name)}
                  />
                </Field>
                <Field
                  id="desc"
                  label="Description"
                  error={errors.description}
                  hint={`${description.trim().length}/500`}
                >
                  <Textarea
                    id="desc"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    aria-invalid={Boolean(errors.description)}
                  />
                </Field>
                <Field
                  id="price"
                  label="Prix de vente (FCFA)"
                  error={errors.price}
                >
                  <Input
                    id="price"
                    type="number"
                    min={0}
                    step={1}
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    aria-invalid={Boolean(errors.price)}
                  />
                </Field>
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
          </TabsContent>

          <TabsContent value="couts" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Coûts de revient</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field
                    id="cout-matiere"
                    label="Coût matière (FCFA)"
                    error={errors.coutMatiere}
                  >
                    <Input
                      id="cout-matiere"
                      type="number"
                      min={0}
                      step={1}
                      value={coutMatiere}
                      onChange={(e) => setCoutMatiere(e.target.value)}
                      aria-invalid={Boolean(errors.coutMatiere)}
                    />
                  </Field>
                  <Field
                    id="cout-emballage"
                    label="Coût emballage (FCFA)"
                    error={errors.coutEmballage}
                  >
                    <Input
                      id="cout-emballage"
                      type="number"
                      min={0}
                      step={1}
                      value={coutEmballage}
                      onChange={(e) => setCoutEmballage(e.target.value)}
                      aria-invalid={Boolean(errors.coutEmballage)}
                    />
                  </Field>
                </div>
                {priceNum > 0 && (
                  <div className="rounded-lg bg-muted px-3 py-2 text-sm">
                    <span className="text-muted-foreground">
                      Marge estimée :{' '}
                    </span>
                    <span className="font-semibold tabular-nums">
                      {priceFormatter.format(
                        priceNum - coutMatiereNum - coutEmballageNum
                      )}{' '}
                      FCFA
                    </span>
                    <span className="ml-2 text-muted-foreground tabular-nums">
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

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Stock du jour</CardTitle>
              </CardHeader>
              <CardContent>
                <Field
                  id="stock-quantity"
                  label="Quantité disponible du jour"
                  help="Vide = illimité (crêpes, boissons…). Un nombre = suivi et décrémenté au paiement."
                >
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
                </Field>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="disponibilite" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Quand ce produit est-il commandable ?
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <ScheduleField
                  schedules={schedules}
                  scheduleId={scheduleId}
                  onChange={setScheduleId}
                  helpText="Restreint la commande aux jours du planning (combiné avec celui de la catégorie si elle en a un)."
                />
                <Field
                  id="advance-order-days"
                  label="Commande à l'avance (jours)"
                  help="Délai minimum entre la commande et le retrait. Vide = pas de contrainte. Combiné avec celui de la catégorie (le plus grand des deux s'applique)."
                >
                  <Input
                    id="advance-order-days"
                    type="number"
                    min={1}
                    max={ADVANCE_ORDER_DAYS_MAX}
                    step={1}
                    placeholder="Aucun"
                    value={advanceOrderDays ?? ''}
                    onChange={(e) =>
                      setAdvanceOrderDays(
                        e.target.value === '' ? null : Number(e.target.value)
                      )
                    }
                  />
                </Field>
              </CardContent>
            </Card>

            {isEdit && initial?.id ? (
              <>
                <PauseField
                  productId={initial.id}
                  initialUnavailableUntil={initial.unavailableUntil}
                />
                <WeeklySpecialField
                  productId={initial.id}
                  initialSpecials={initial.weeklySpecials}
                />
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                La pause programmée et les semaines spéciales seront disponibles
                une fois le produit créé.
              </p>
            )}
          </TabsContent>

          <TabsContent value="supplements">
            <SupplementsEditor
              groups={groups}
              onChange={setGroups}
              issues={showSupplementErrors ? supplementIssues : undefined}
            />
          </TabsContent>

          <TabsContent value="mise-en-avant">
            <BadgesField
              featured={featured}
              featuredOrder={featuredOrder}
              featuredBadge={featuredBadge}
              onFeaturedChange={setFeatured}
              onFeaturedOrderChange={setFeaturedOrder}
              onFeaturedBadgeChange={setFeaturedBadge}
            />
          </TabsContent>

          {statsSlot && <TabsContent value="stats">{statsSlot}</TabsContent>}
        </Tabs>

        {/* Barre d'action collante : le formulaire dépasse la hauteur de
            l'écran sur chaque onglet, « Enregistrer » ne doit jamais exiger un
            défilement pour être atteint. */}
        <div className="sticky bottom-0 z-10 -mx-1 border-t bg-background/95 px-1 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" disabled={isPending || isUploading}>
              {isPending && <Loader2 className="size-4 animate-spin" />}
              {isPending
                ? 'Enregistrement…'
                : isEdit
                  ? 'Enregistrer'
                  : 'Créer le produit'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={isPending}
            >
              Annuler
            </Button>
            {isUploading && (
              <span className="text-sm text-muted-foreground">
                Image en cours d&apos;envoi…
              </span>
            )}
            {!isUploading && isDirty && !isPending && (
              <span className="text-sm text-amber-600">
                Modifications non enregistrées
              </span>
            )}
          </div>
          {submitError && (
            <p className="mt-2 flex items-center gap-1.5 text-sm text-destructive">
              <AlertCircle className="size-4 shrink-0" />
              {submitError}
            </p>
          )}
        </div>
      </form>

      <ConfirmDialog
        open={confirmLeave}
        onOpenChange={setConfirmLeave}
        title="Abandonner les modifications ?"
        description="Les changements de cette fiche n’ont pas été enregistrés. Ils seront perdus."
        confirmLabel="Abandonner"
        cancelLabel="Continuer l’édition"
        destructive
        onConfirm={leave}
      />
    </>
  );
}

/** Déclencheur d'onglet avec pastille d'erreur. */
function TabTrigger({
  value,
  hasError,
  children,
}: {
  value: TabValue;
  hasError: boolean;
  children: ReactNode;
}) {
  return (
    // `h-8` explicite : la hauteur native (`h-[calc(100%-1px)]`) se résout
    // contre celle de la liste, devenue `auto` pour permettre le repli.
    <TabsTrigger value={value} className="h-8 gap-1.5">
      {children}
      {hasError && (
        <span
          aria-label="contient une erreur"
          className="size-1.5 rounded-full bg-destructive"
        />
      )}
    </TabsTrigger>
  );
}

/** Libellé + contrôle + aide/erreur, pour ne pas répéter la structure. */
function Field({
  id,
  label,
  help,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  help?: string;
  /** Compteur discret aligné à droite du libellé (ex. « 42/120 »). */
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <Label htmlFor={id}>{label}</Label>
        {hint && (
          <span className="text-xs tabular-nums text-muted-foreground">
            {hint}
          </span>
        )}
      </div>
      {children}
      {help && !error && (
        <p className="text-xs text-muted-foreground">{help}</p>
      )}
      {error && (
        <p className="flex items-center gap-1.5 text-xs font-medium text-destructive">
          <AlertCircle className="size-3.5 shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}
