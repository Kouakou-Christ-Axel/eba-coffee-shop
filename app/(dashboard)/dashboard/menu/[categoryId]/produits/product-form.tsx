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
//
// Trois signaux distincts cohabitent ici, et les confondre casse l'écran :
//   • le RAPPEL (barre du bas) annonce en permanence ce qui reste à remplir ;
//     il n'a jamais l'air de reprocher quoi que ce soit ;
//   • l'ERREUR (rouge) interdit d'enregistrer et n'apparaît qu'après une
//     tentative — on ne reproche pas un champ vide à qui est en train de le
//     remplir ;
//   • l'AVERTISSEMENT (ambre) n'interdit rien : les coûts à zéro faussent la
//     marge, mais certains produits n'en ont réellement aucun de saisi.
// La logique des trois vit dans `lib/menu/product-form-completeness.ts`,
// testable hors JSX.

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useReducedMotion } from 'framer-motion';
import { AlertCircle, AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
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
import {
  amountOrZero,
  costWarning,
  FIELD_IDS,
  FIELD_TAB,
  firstFaultyField,
  isTabValue,
  listMissingRequired,
  validateProductDraft,
  VALIDATED_FIELDS,
  type FieldErrors,
  type ProductDraft,
  type TabValue,
  type ValidatedField,
} from '@/lib/menu/product-form-completeness';
import {
  ADVANCE_ORDER_DAYS_MAX,
  MIN_DEPOSIT_PERCENT,
} from '@/config/constants';

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
  // Commande spéciale sur mesure (ex. gâteau grand format) : exige un acompte
  // minimum au checkout — voir `Product.requiresDeposit`, prisma/schema.prisma.
  requiresDeposit: boolean;
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
  requiresDeposit: false,
  weeklySpecials: [],
};

const priceFormatter = new Intl.NumberFormat('fr-FR');

/**
 * Montant initial d'un `<input type="number">`.
 *
 * En CRÉATION, on rend `''` et non `'0'` : un prix affichant « 0 » a l'air
 * rempli, et le produit partait à 0 FCFA sans que personne ne s'en aperçoive.
 * En ÉDITION on montre la valeur réelle, y compris un vrai `0` saisi.
 */
function initialAmount(value: number | undefined): string {
  return value === undefined ? '' : String(value);
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
  const reduceMotion = useReducedMotion();
  const [isPending, startTransition] = useTransition();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [confirmLeave, setConfirmLeave] = useState(false);
  /** `id` du champ à atteindre au prochain rendu, et son réveil — `goToField`. */
  const focusRequest = useRef<string | null>(null);
  const [focusNonce, setFocusNonce] = useState(0);

  const [tab, setTab] = useState<TabValue>(() =>
    isTabValue(defaultTab) && (defaultTab !== 'stats' || statsSlot)
      ? defaultTab
      : 'essentiel'
  );

  const [name, setName] = useState(initial?.name ?? EMPTY.name);
  const [description, setDescription] = useState(
    initial?.description ?? EMPTY.description
  );
  const [price, setPrice] = useState<string>(() =>
    initialAmount(initial?.price)
  );
  const [coutMatiere, setCoutMatiere] = useState<string>(() =>
    initialAmount(initial?.coutMatiere)
  );
  const [coutEmballage, setCoutEmballage] = useState<string>(() =>
    initialAmount(initial?.coutEmballage)
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
  const [requiresDeposit, setRequiresDeposit] = useState(
    initial?.requiresDeposit ?? EMPTY.requiresDeposit
  );

  const priceNum = amountOrZero(price);
  const coutMatiereNum = amountOrZero(coutMatiere);
  const coutEmballageNum = amountOrZero(coutEmballage);
  const isEdit = Boolean(initial?.id);

  const draft: ProductDraft = {
    name,
    description,
    price,
    coutMatiere,
    coutEmballage,
  };
  // Rappel permanent, sans reproche : il ne regarde que le vide. Un nom trop
  // long est saisi — c'est l'affaire des erreurs, pas du rappel.
  const missing = listMissingRequired(draft);
  const costHint = costWarning(draft);

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
    requiresDeposit,
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
        requiresDeposit: initial?.requiresDeposit ?? EMPTY.requiresDeposit,
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

  /**
   * Ouvre l'onglet du champ ET y place le curseur.
   *
   * Changer d'onglet ne suffisait pas : sur un onglet qui dépasse la hauteur de
   * l'écran, le message rouge pouvait rester hors de vue, et l'écran donnait
   * l'impression de n'avoir rien fait.
   *
   * Le focus ne peut pas être posé ici : Radix ne monte pas le contenu d'un
   * onglet masqué, donc au moment du `setTab` le champ visé n'existe pas encore
   * dans le DOM. On enregistre la demande (ref) et on réveille l'effet
   * (compteur), qui s'exécutera après le rendu ayant monté le champ. La cible
   * vit dans une ref et non dans un state pour que l'effet puisse la consommer
   * sans déclencher un rendu de plus — le compteur, lui, doit être un state
   * pour que deux demandes successives sur le MÊME champ relancent l'effet.
   */
  function goToField(field: ValidatedField) {
    changeTab(FIELD_TAB[field]);
    focusRequest.current = FIELD_IDS[field];
    setFocusNonce((n) => n + 1);
  }

  useEffect(() => {
    const id = focusRequest.current;
    if (!id) return;
    focusRequest.current = null;
    const el = document.getElementById(id);
    if (!el) return;
    // `preventScroll` puis `scrollIntoView` : le défilement natif du focus
    // colle le champ en haut ou en bas de la fenêtre, souvent sous la barre
    // d'action collante. On veut le champ au centre, avec son libellé.
    el.focus({ preventScroll: true });
    el.scrollIntoView({
      block: 'center',
      behavior: reduceMotion ? 'auto' : 'smooth',
    });
  }, [focusNonce, reduceMotion]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);

    const found = validateProductDraft(draft);
    setErrors(found);
    const firstField = firstFaultyField(found);
    if (firstField) {
      goToField(firstField);
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
        requiresDeposit,
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
            <TabTrigger
              value="couts"
              hasError={errorTabs.has('couts')}
              hasWarning={Boolean(costHint)}
            >
              Coûts &amp; stock
            </TabTrigger>
            <TabTrigger value="disponibilite" hasError={false} optional>
              Disponibilité
            </TabTrigger>
            <TabTrigger
              value="supplements"
              hasError={showSupplementErrors && supplementIssues.size > 0}
              optional={groups.length === 0}
            >
              Suppléments
              {groups.length > 0 && (
                <span className="text-muted-foreground">({groups.length})</span>
              )}
            </TabTrigger>
            <TabTrigger value="mise-en-avant" hasError={false} optional>
              Mise en avant
            </TabTrigger>
            {statsSlot && (
              <TabTrigger value="stats" hasError={false}>
                Statistiques
              </TabTrigger>
            )}
          </TabsList>

          <TabsContent value="essentiel" className="space-y-4">
            {/* En création seulement : quelqu'un qui découvre l'écran voit six
                onglets et croit devoir tous les remplir. On lui dit d'entrée
                que trois champs suffisent. En édition, la personne connaît
                déjà sa fiche — le bandeau ne serait que du bruit. */}
            {!isEdit && (
              <p className="rounded-lg border border-dashed px-3 py-2.5 text-sm text-muted-foreground">
                Trois champs suffisent pour créer le produit :{' '}
                <span className="font-medium text-foreground">nom</span>,{' '}
                <span className="font-medium text-foreground">description</span>{' '}
                et{' '}
                <span className="font-medium text-foreground">
                  prix de vente
                </span>
                . Photo, coûts, suppléments et mise en avant se complètent quand
                vous voulez.
              </p>
            )}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Identité du produit</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Field
                  id="name"
                  label="Nom"
                  required
                  error={errors.name}
                  hint={`${name.trim().length}/120`}
                  help="Le nom vu par le client sur la carte. Ex. « Café latte »."
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
                  required
                  help="Une phrase courte, affichée sous le nom sur la carte."
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
                  required
                  help="Ce que paie le client pour une unité."
                  error={errors.price}
                >
                  <Input
                    id="price"
                    type="number"
                    min={0}
                    step={1}
                    // Vide plutôt que « 0 » à la création : un champ affichant
                    // zéro a l'air rempli, et des produits sont partis à
                    // 0 FCFA sans que personne ne le remarque.
                    placeholder="Ex. 2000"
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
                    help="Ce que vous coûtent les ingrédients pour une unité."
                    error={errors.coutMatiere}
                  >
                    <Input
                      id="cout-matiere"
                      type="number"
                      min={0}
                      step={1}
                      placeholder="Ex. 600"
                      value={coutMatiere}
                      onChange={(e) => setCoutMatiere(e.target.value)}
                      aria-invalid={Boolean(errors.coutMatiere)}
                    />
                  </Field>
                  <Field
                    id="cout-emballage"
                    label="Coût emballage (FCFA)"
                    help="Gobelet, boîte, couvercle, serviette… pour une unité."
                    error={errors.coutEmballage}
                  >
                    <Input
                      id="cout-emballage"
                      type="number"
                      min={0}
                      step={1}
                      placeholder="Ex. 150"
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
                {/* Avertissement, pas erreur : on n'interdit rien. Certains
                    produits n'ont réellement aucun coût saisi, et forcer une
                    valeur inventée serait pire que l'absence — mais laisser
                    croire à 100 % de marge fausse tout le suivi. */}
                {costHint && (
                  <p className="flex items-start gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
                    <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                    {costHint}
                  </p>
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
                  help="Vide = illimité (crêpes, boissons…). Un nombre = suivi et décrémenté à l'entrée en cuisine. Une commande pour un autre jour n'y touche pas."
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
                <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
                  <div>
                    <Label htmlFor="requires-deposit">
                      Commande spéciale — acompte requis
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Ex. gâteau grand format. Un acompte minimum de{' '}
                      {MIN_DEPOSIT_PERCENT}% sera exigé avant l&apos;entrée en
                      cuisine.
                    </p>
                  </div>
                  <Switch
                    id="requires-deposit"
                    checked={requiresDeposit}
                    onCheckedChange={setRequiresDeposit}
                  />
                </div>
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

          {/* Rappel de ce qui reste à remplir. Affiché en permanence, y compris
              avant toute tentative : il ANNONCE, il ne reproche pas — d'où le
              ton neutre et l'absence de rouge. Chaque libellé mène à son
              champ, ce qui évite de chercher dans quel onglet il se trouve. */}
          {!isPending && missing.length > 0 && (
            <p className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-muted-foreground">
              <span>
                Il reste {missing.length} champ
                {missing.length > 1 ? 's' : ''} obligatoire
                {missing.length > 1 ? 's' : ''} :
              </span>
              {missing.map((m, i) => (
                <span key={m.field}>
                  <button
                    type="button"
                    onClick={() => goToField(m.field)}
                    className="font-medium text-foreground underline underline-offset-4 hover:text-primary"
                  >
                    {m.label}
                  </button>
                  {i < missing.length - 1 && ','}
                </span>
              ))}
            </p>
          )}
          {!isPending && missing.length === 0 && !isEdit && !submitError && (
            <p className="mt-2 text-sm text-muted-foreground">
              Prêt à créer. Le reste peut se compléter plus tard.
            </p>
          )}

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

/**
 * Déclencheur d'onglet, avec pastille d'erreur (rouge, bloquant) ou
 * d'avertissement (ambre, informatif) et mention « optionnel ».
 *
 * La mention n'est pas décorative : six onglets laissent croire à six étapes
 * obligatoires, alors que trois champs d'un seul onglet suffisent.
 */
function TabTrigger({
  value,
  hasError,
  hasWarning = false,
  optional = false,
  children,
}: {
  value: TabValue;
  hasError: boolean;
  hasWarning?: boolean;
  optional?: boolean;
  children: ReactNode;
}) {
  return (
    // `h-8` explicite : la hauteur native (`h-[calc(100%-1px)]`) se résout
    // contre celle de la liste, devenue `auto` pour permettre le repli.
    <TabsTrigger value={value} className="h-8 gap-1.5">
      {children}
      {optional && (
        <span className="text-xs font-normal text-muted-foreground">
          optionnel
        </span>
      )}
      {hasError ? (
        <span
          aria-label="contient une erreur"
          className="size-1.5 rounded-full bg-destructive"
        />
      ) : (
        hasWarning && (
          <span
            aria-label="contient un avertissement"
            className="size-1.5 rounded-full bg-amber-500"
          />
        )
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
  required = false,
  children,
}: {
  id: string;
  label: string;
  help?: string;
  /** Compteur discret aligné à droite du libellé (ex. « 42/120 »). */
  hint?: string;
  error?: string;
  /**
   * Marque le champ comme requis par le serveur. Écrit en toutes lettres
   * plutôt qu'avec un astérisque : la convention de l'astérisque suppose une
   * légende, qui n'existe nulle part ici.
   */
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <Label htmlFor={id} className="gap-1.5">
          {label}
          <span
            className={
              required
                ? 'text-xs font-normal text-destructive'
                : 'text-xs font-normal text-muted-foreground'
            }
          >
            {required ? 'obligatoire' : 'optionnel'}
          </span>
        </Label>
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
