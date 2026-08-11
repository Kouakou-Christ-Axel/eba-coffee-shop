'use client';

// Éditeur de groupes de suppléments (« goûts », « extras »), partagé SANS
// variante par deux écrans : l'onglet « Suppléments » de la fiche produit et la
// page Extras globaux. Toute modification ici se voit aux deux endroits.
//
// Principe directeur : rien d'implicite. L'ancienne version n'identifiait ses
// colonnes que par des `placeholder` — qui disparaissent dès la saisie — et
// n'exprimait « stock illimité » qu'en laissant un champ vide, règle qu'il
// fallait connaître pour la deviner. Ici chaque valeur porte un libellé
// permanent et « Illimité » est un état qu'on choisit d'un bouton.
//
// ⚠ `useUndoToast` exige un `<UndoToastProvider>` au-dessus : il est monté dans
// `app/(dashboard)/dashboard/menu/layout.tsx`, qui couvre les deux écrans.

import { useId, useState } from 'react';
import { Reorder, useDragControls, useReducedMotion } from 'framer-motion';
import { AlertCircle, GripVertical, Plus, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { ConfirmDialog } from '@/components/(dashboard)/confirm-dialog';
import { useUndoToast } from '@/lib/hooks/use-undo-toast';
import {
  GROUP_TYPES,
  summarizeGroup,
  toCanonicalGroup,
  type SupplementGroup,
  type SupplementGroupIssues,
  type SupplementGroupType,
  type SupplementOption,
} from '@/lib/supplements-form';
import { cn } from '@/lib/utils';

// Les types vivent désormais dans `lib/supplements-form.ts` (logique pure,
// testable en environnement node) ; on les ré-exporte pour ne pas casser les
// imports existants des deux formulaires consommateurs.
export type { SupplementGroup, SupplementOption };

// ─── Miroir interne à identité stable ────────────────────────────────────────
//
// Les lignes étaient indexées par position (`key={oi}`) alors que le champ Prix
// garde un brouillon local : supprimer une option au milieu réutilisait le
// composant sans le remonter, et le prix affiché restait celui de l'option
// supprimée. On attache donc un identifiant stable à chaque groupe/option.
//
// ⚠ `uid` ne sort JAMAIS par `onChange` : `product-form` compare l'état au
// snapshot initial par `JSON.stringify` pour son marqueur « modifications non
// enregistrées », et une clé en trop le rendrait perpétuellement actif.

type UiOption = SupplementOption & { uid: string };
type UiGroup = Omit<SupplementGroup, 'options'> & {
  uid: string;
  options: UiOption[];
};

let uidSeq = 0;
/** Sert uniquement de `key` React — jamais sérialisé, donc sans risque SSR. */
function nextUid(): string {
  uidSeq += 1;
  return `s${uidSeq}`;
}

function toUiGroup(g: SupplementGroup): UiGroup {
  return {
    ...g,
    uid: nextUid(),
    options: g.options.map((o) => ({ ...o, uid: nextUid() })),
  };
}

// `toCanonicalGroup` recopie les champs un par un : `uid` ne peut donc pas
// fuir, et l'ordre des clés reste celui du mapping initial — dont dépend le
// marqueur « modifications non enregistrées », qui compare des JSON.
const fromUiGroup = toCanonicalGroup;

function emptyGroup(): UiGroup {
  return {
    uid: nextUid(),
    name: '',
    type: 'single',
    required: false,
    available: true,
    minSelect: null,
    maxSelect: null,
    options: [emptyOption()],
  };
}

function emptyOption(): UiOption {
  return {
    uid: nextUid(),
    name: '',
    price: 0,
    available: true,
    stockQuantity: null,
  };
}

type Props = {
  groups: SupplementGroup[];
  onChange: (groups: SupplementGroup[]) => void;
  /**
   * Erreurs à afficher, indexées par position de groupe. Fournies par le
   * formulaire parent APRÈS une tentative d'enregistrement : on ne reproche pas
   * un champ vide à quelqu'un qui est en train de le remplir.
   */
  issues?: ReadonlyMap<number, SupplementGroupIssues>;
};

export function SupplementsEditor({ groups, onChange, issues }: Props) {
  const { pushUndo } = useUndoToast();
  const reduceMotion = useReducedMotion();

  // La prop `groups` n'est lue qu'au montage : les deux parents ne la modifient
  // que via `onChange`, et l'onglet « Suppléments » démonte l'éditeur quand on
  // le quitte — le miroir ne peut pas diverger.
  const [ui, setUi] = useState<UiGroup[]>(() => groups.map(toUiGroup));
  const [openIds, setOpenIds] = useState<ReadonlySet<string>>(() =>
    ui.length === 1 ? new Set([ui[0].uid]) : new Set()
  );
  const [pendingDelete, setPendingDelete] = useState<UiGroup | null>(null);

  // Un groupe fautif doit s'ouvrir, sinon son message reste caché sous un
  // repli. Ajustement pendant le rendu (pas d'effet), et `openIds` reste la
  // source unique de vérité du `<details>` : un `open={... || hasError}` ne
  // serait pas repatché par React après une fermeture manuelle, et le DOM
  // divergerait de l'état.
  const issueKey = issues ? [...issues.keys()].join(',') : '';
  const [prevIssueKey, setPrevIssueKey] = useState(issueKey);
  if (issueKey !== prevIssueKey) {
    setPrevIssueKey(issueKey);
    if (issues && issues.size > 0) {
      const faulty = [...issues.keys()]
        .map((gi) => ui[gi]?.uid)
        .filter((uid): uid is string => Boolean(uid));
      setOpenIds((prev) => new Set([...prev, ...faulty]));
    }
  }

  function commit(next: UiGroup[]) {
    setUi(next);
    onChange(next.map(fromUiGroup));
  }

  function setOpen(uid: string, open: boolean) {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (open) next.add(uid);
      else next.delete(uid);
      return next;
    });
  }

  function addGroup() {
    const group = emptyGroup();
    commit([...ui, group]);
    setOpen(group.uid, true);
  }

  function updateGroup(uid: string, patch: Partial<UiGroup>) {
    commit(ui.map((g) => (g.uid === uid ? { ...g, ...patch } : g)));
  }

  function removeGroup(group: UiGroup) {
    commit(ui.filter((g) => g.uid !== group.uid));
    setPendingDelete(null);
  }

  function requestRemoveGroup(group: UiGroup) {
    const filled =
      group.name.trim() !== '' ||
      group.options.some((o) => o.name.trim() !== '');
    if (filled) setPendingDelete(group);
    else removeGroup(group);
  }

  function addOption(uid: string) {
    const group = ui.find((g) => g.uid === uid);
    if (!group) return;
    updateGroup(uid, { options: [...group.options, emptyOption()] });
  }

  function updateOption(
    groupUid: string,
    optionUid: string,
    patch: Partial<UiOption>
  ) {
    const group = ui.find((g) => g.uid === groupUid);
    if (!group) return;
    updateGroup(groupUid, {
      options: group.options.map((o) =>
        o.uid === optionUid ? { ...o, ...patch } : o
      ),
    });
  }

  function removeOption(groupUid: string, option: UiOption) {
    const group = ui.find((g) => g.uid === groupUid);
    if (!group) return;
    const index = group.options.findIndex((o) => o.uid === option.uid);
    updateGroup(groupUid, {
      options: group.options.filter((o) => o.uid !== option.uid),
    });

    pushUndo({
      message: `Option « ${option.name.trim() || 'sans nom'} » supprimée`,
      onUndo: () => {
        // Réinsertion dans l'état COURANT : rejouer l'ancien tableau effacerait
        // les frappes faites entre la suppression et le clic sur « Annuler ».
        setUi((prev) => {
          const next = prev.map((g) => {
            if (g.uid !== groupUid) return g;
            const options = [...g.options];
            options.splice(Math.min(index, options.length), 0, option);
            return { ...g, options };
          });
          onChange(next.map(fromUiGroup));
          return next;
        });
      },
    });
  }

  function reorderGroups(uids: string[]) {
    const byUid = new Map(ui.map((g) => [g.uid, g]));
    commit(
      uids
        .map((uid) => byUid.get(uid))
        .filter((g): g is UiGroup => g !== undefined)
    );
  }

  return (
    <Card>
      <CardHeader className="px-3 sm:px-6">
        <CardTitle className="text-base">Groupes de suppléments</CardTitle>
        <CardDescription>
          Un groupe est une question posée au client (« Choix du lait ») ; ses
          options en sont les réponses.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-3 px-3 sm:px-6">
        {ui.length === 0 && (
          <p className="rounded-lg border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
            Aucun groupe de suppléments.
          </p>
        )}

        <Reorder.Group
          as="div"
          axis="y"
          values={ui.map((g) => g.uid)}
          onReorder={reorderGroups}
          className="space-y-3"
        >
          {ui.map((group, gi) => (
            <GroupCard
              key={group.uid}
              group={group}
              issues={issues?.get(gi)}
              open={openIds.has(group.uid)}
              reduceMotion={Boolean(reduceMotion)}
              onToggle={(open) => setOpen(group.uid, open)}
              onUpdate={(patch) => updateGroup(group.uid, patch)}
              onRemove={() => requestRemoveGroup(group)}
              onAddOption={() => addOption(group.uid)}
              onUpdateOption={(optionUid, patch) =>
                updateOption(group.uid, optionUid, patch)
              }
              onRemoveOption={(option) => removeOption(group.uid, option)}
              onReorderOptions={(options) =>
                updateGroup(group.uid, { options })
              }
            />
          ))}
        </Reorder.Group>

        <Button
          type="button"
          variant="outline"
          onClick={addGroup}
          className="h-11 w-full sm:h-9 sm:w-auto"
        >
          <Plus className="size-4" /> Ajouter un groupe
        </Button>
      </CardContent>

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        title="Supprimer ce groupe ?"
        description={
          pendingDelete
            ? `« ${pendingDelete.name.trim() || 'Nouveau groupe'} » et ses ${pendingDelete.options.length} option(s) seront retirés du formulaire. La suppression deviendra définitive à l’enregistrement.`
            : ''
        }
        confirmLabel="Supprimer"
        destructive
        onConfirm={() => {
          if (pendingDelete) removeGroup(pendingDelete);
        }}
      />
    </Card>
  );
}

// ─── Un groupe ────────────────────────────────────────────────────────────────

function GroupCard({
  group,
  issues,
  open,
  reduceMotion,
  onToggle,
  onUpdate,
  onRemove,
  onAddOption,
  onUpdateOption,
  onRemoveOption,
  onReorderOptions,
}: {
  group: UiGroup;
  issues?: SupplementGroupIssues;
  open: boolean;
  reduceMotion: boolean;
  onToggle: (open: boolean) => void;
  onUpdate: (patch: Partial<UiGroup>) => void;
  onRemove: () => void;
  onAddOption: () => void;
  onUpdateOption: (optionUid: string, patch: Partial<UiOption>) => void;
  onRemoveOption: (option: UiOption) => void;
  onReorderOptions: (options: UiOption[]) => void;
}) {
  const id = useId();
  const controls = useDragControls();
  // Les bornes ne peuvent pas se déduire des valeurs : à l'ouverture du volet,
  // min et max valent encore `null`. Il faut donc un état propre.
  const [showBounds, setShowBounds] = useState(
    group.minSelect != null || group.maxSelect != null
  );

  const hasError = Boolean(
    issues && (issues.group.length > 0 || issues.options.some(Boolean))
  );

  function reorderOptions(uids: string[]) {
    const byUid = new Map(group.options.map((o) => [o.uid, o]));
    onReorderOptions(
      uids
        .map((uid) => byUid.get(uid))
        .filter((o): o is UiOption => o !== undefined)
    );
  }

  return (
    <Reorder.Item
      as="div"
      value={group.uid}
      dragListener={false}
      dragControls={controls}
      layout="position"
      transition={reduceMotion ? { duration: 0 } : undefined}
    >
      <details
        open={open}
        onToggle={(e) => onToggle(e.currentTarget.open)}
        className={cn(
          'rounded-xl border bg-card open:shadow-sm',
          hasError && 'border-destructive/50'
        )}
      >
        {/* `list-none` retire le triangle natif (Firefox) ; `flex` s'en charge
            déjà sur Chrome et Safari. */}
        <summary className="flex cursor-pointer list-none items-center gap-2 p-2">
          {/* Rotation pilotée par la prop plutôt que par un variant `group-open`
              : `open` est déjà la source de vérité du repli. */}
          <span
            className={cn(
              'flex size-8 shrink-0 items-center justify-center text-muted-foreground transition-transform',
              open && 'rotate-90'
            )}
          >
            <ChevronRightIcon />
          </span>

          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">
              {group.name.trim() || (
                <span className="text-muted-foreground italic">
                  Nouveau groupe
                </span>
              )}
            </span>
            <span className="block truncate text-xs text-muted-foreground">
              {summarizeGroup(group)}
            </span>
          </span>

          {hasError && (
            <span
              aria-label="Ce groupe contient une erreur"
              className="size-2 shrink-0 rounded-full bg-destructive"
            />
          )}
          {!group.available && (
            <Badge variant="secondary" className="shrink-0">
              Masqué
            </Badge>
          )}

          {/* Poignée dans le `summary` : `preventDefault` empêche le repli du
              bloc, que l'activation par défaut déclencherait en plus du drag. */}
          <button
            type="button"
            aria-label={`Déplacer le groupe ${group.name.trim() || 'sans nom'}`}
            onPointerDown={(e) => {
              e.preventDefault();
              controls.start(e);
            }}
            // Sans ça, le clic remonterait au `summary` et replierait le bloc
            // en plus de déclencher le glissement.
            onClick={(e) => e.preventDefault()}
            className="flex size-9 shrink-0 cursor-grab touch-none items-center justify-center rounded-md text-muted-foreground hover:bg-muted active:cursor-grabbing"
          >
            <GripVertical className="size-4" />
          </button>
        </summary>

        <div className="space-y-4 border-t p-3 sm:p-4">
          {issues && issues.group.length > 0 && (
            <ul className="space-y-1 rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {issues.group.map((message) => (
                <li key={message} className="flex gap-1.5">
                  <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
                  {message}
                </li>
              ))}
            </ul>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor={`${id}-name`}>Nom du groupe</Label>
              <Input
                id={`${id}-name`}
                value={group.name}
                placeholder="ex : Choix du lait"
                className="h-11 sm:h-9"
                onChange={(e) => onUpdate({ name: e.target.value })}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor={`${id}-type`}>Type de choix</Label>
              <Select
                value={group.type}
                onValueChange={(value) =>
                  onUpdate({ type: value as SupplementGroupType })
                }
              >
                {/* `data-[size=default]:h-9` de la base ne se laisse pas
                    écraser par un `h-11` nu : modificateurs différents, donc
                    groupes distincts pour tailwind-merge, et le sélecteur
                    d'attribut gagne en spécificité. */}
                <SelectTrigger
                  id={`${id}-type`}
                  className="w-full data-[size=default]:h-11 sm:data-[size=default]:h-9"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(GROUP_TYPES).map(([value, { label }]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {GROUP_TYPES[group.type].help}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <ToggleRow
              id={`${id}-required`}
              label="Choix obligatoire"
              checked={group.required}
              onChange={(required) => onUpdate({ required })}
            />
            <ToggleRow
              id={`${id}-available`}
              label="Afficher ce groupe"
              checked={group.available}
              onChange={(available) => onUpdate({ available })}
            />
          </div>

          {group.type !== 'single' && (
            <div className="space-y-2">
              <ToggleRow
                id={`${id}-bounds`}
                label={
                  group.type === 'quantity'
                    ? 'Limiter la quantité totale'
                    : 'Limiter le nombre de choix'
                }
                checked={showBounds}
                onChange={(next) => {
                  setShowBounds(next);
                  if (!next) onUpdate({ minSelect: null, maxSelect: null });
                }}
              />
              {showBounds && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor={`${id}-min`}>Minimum</Label>
                    <Input
                      id={`${id}-min`}
                      type="number"
                      inputMode="numeric"
                      min={0}
                      placeholder="Aucun"
                      value={group.minSelect ?? ''}
                      className="h-11 tabular-nums sm:h-9"
                      onChange={(e) =>
                        onUpdate({
                          minSelect:
                            e.target.value === ''
                              ? null
                              : Number(e.target.value),
                        })
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor={`${id}-max`}>Maximum</Label>
                    <Input
                      id={`${id}-max`}
                      type="number"
                      inputMode="numeric"
                      min={1}
                      placeholder="Aucun"
                      value={group.maxSelect ?? ''}
                      className="h-11 tabular-nums sm:h-9"
                      onChange={(e) =>
                        onUpdate({
                          maxSelect:
                            e.target.value === ''
                              ? null
                              : Number(e.target.value),
                        })
                      }
                    />
                  </div>
                  {group.type === 'quantity' && (
                    <p className="col-span-2 text-xs text-muted-foreground">
                      Pour une quantité fixe (ex. 3 parts), mettez le même
                      nombre en minimum et en maximum.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label className="text-sm">Options ({group.options.length})</Label>
            <p className="text-xs text-muted-foreground">
              Prix en FCFA (0 = compris dans le produit). Stock : « Illimité »,
              ou une quantité — 0 signifie épuisé.
            </p>

            {group.options.length === 0 && (
              <p className="rounded-md border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">
                Aucune option. Un groupe doit en compter au moins une.
              </p>
            )}

            <Reorder.Group
              as="div"
              axis="y"
              values={group.options.map((o) => o.uid)}
              onReorder={reorderOptions}
              className="space-y-2"
            >
              {group.options.map((option, oi) => (
                <OptionCard
                  key={option.uid}
                  option={option}
                  index={oi}
                  error={issues?.options[oi] ?? null}
                  reduceMotion={reduceMotion}
                  onUpdate={(patch) => onUpdateOption(option.uid, patch)}
                  onRemove={() => onRemoveOption(option)}
                />
              ))}
            </Reorder.Group>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onAddOption}
              className="h-11 w-full sm:h-9 sm:w-auto"
            >
              <Plus className="size-4" /> Ajouter une option
            </Button>
          </div>

          <div className="border-t pt-3">
            <Button
              type="button"
              variant="ghost"
              onClick={onRemove}
              className="h-11 w-full text-destructive hover:bg-destructive/10 hover:text-destructive sm:h-9 sm:w-auto"
            >
              <Trash2 className="size-4" /> Supprimer le groupe
            </Button>
          </div>
        </div>
      </details>
    </Reorder.Item>
  );
}

// ─── Une option ───────────────────────────────────────────────────────────────

function OptionCard({
  option,
  index,
  error,
  reduceMotion,
  onUpdate,
  onRemove,
}: {
  option: UiOption;
  index: number;
  error: string | null;
  reduceMotion: boolean;
  onUpdate: (patch: Partial<UiOption>) => void;
  onRemove: () => void;
}) {
  const id = useId();
  const controls = useDragControls();

  // Brouillon de saisie du prix : sans lui, vider le champ le réécrirait
  // aussitôt en `0` (`Number('') || 0`) en pleine frappe. Il est désormais
  // ancré à un composant à clé stable, d'où la disparition du bug qui
  // affichait le prix d'une option supprimée.
  const [priceText, setPriceText] = useState(() =>
    option.price === 0 ? '' : String(option.price)
  );
  // Dernière quantité connue, pour que Limité → Illimité → Limité ne la perde
  // pas.
  const [lastStock, setLastStock] = useState(option.stockQuantity ?? 0);

  const unlimited = option.stockQuantity == null;

  return (
    <Reorder.Item
      as="div"
      value={option.uid}
      dragListener={false}
      dragControls={controls}
      layout="position"
      transition={reduceMotion ? { duration: 0 } : undefined}
      className={cn(
        'space-y-2 rounded-lg border bg-muted/30 p-3',
        error && 'border-destructive/50',
        !option.available && 'opacity-70'
      )}
    >
      <div className="flex items-center gap-1">
        <button
          type="button"
          aria-label={`Déplacer l’option ${index + 1}`}
          onPointerDown={(e) => controls.start(e)}
          className="flex size-9 shrink-0 cursor-grab touch-none items-center justify-center rounded-md text-muted-foreground hover:bg-muted active:cursor-grabbing"
        >
          <GripVertical className="size-4" />
        </button>
        <Label
          htmlFor={`${id}-name`}
          className="flex-1 text-xs font-medium text-muted-foreground"
        >
          Option {index + 1}
        </Label>
        <Button
          type="button"
          variant="ghost"
          onClick={onRemove}
          aria-label={`Supprimer l’option ${index + 1}`}
          className="size-10 text-destructive hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 className="size-4" />
        </Button>
      </div>

      <Input
        id={`${id}-name`}
        value={option.name}
        placeholder="Nom du goût"
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        className="h-11 sm:h-9"
        onChange={(e) => onUpdate({ name: e.target.value })}
      />

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div className="space-y-1">
          <Label
            htmlFor={`${id}-price`}
            className="text-xs text-muted-foreground"
          >
            Prix (FCFA)
          </Label>
          <Input
            id={`${id}-price`}
            type="number"
            inputMode="numeric"
            min={0}
            step={1}
            placeholder="0"
            value={priceText}
            className="h-11 tabular-nums sm:h-9"
            onChange={(e) => {
              setPriceText(e.target.value);
              onUpdate({ price: Number(e.target.value) || 0 });
            }}
          />
        </div>

        <div className="space-y-1">
          <Label
            htmlFor={unlimited ? undefined : `${id}-stock`}
            className="text-xs text-muted-foreground"
          >
            Stock du jour
          </Label>
          {/* « Illimité » était jusqu'ici un champ laissé vide — une règle
              qu'il fallait connaître. C'est maintenant un état qu'on choisit,
              et qu'on lit. */}
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant={unlimited ? 'default' : 'outline'}
              aria-pressed={unlimited}
              onClick={() => onUpdate({ stockQuantity: null })}
              className="h-11 flex-1 sm:h-9"
            >
              Illimité
            </Button>
            {unlimited ? (
              <Button
                type="button"
                variant="outline"
                aria-pressed={false}
                onClick={() => onUpdate({ stockQuantity: lastStock })}
                className="h-11 flex-1 sm:h-9"
              >
                Limité
              </Button>
            ) : (
              <Input
                id={`${id}-stock`}
                type="number"
                inputMode="numeric"
                min={0}
                step={1}
                aria-label="Quantité restante"
                value={option.stockQuantity ?? ''}
                className="h-11 flex-1 tabular-nums sm:h-9"
                onChange={(e) => {
                  const next =
                    e.target.value === '' ? 0 : Number(e.target.value);
                  setLastStock(next);
                  onUpdate({ stockQuantity: next });
                }}
              />
            )}
          </div>
        </div>
      </div>

      <ToggleRow
        id={`${id}-available`}
        label="Disponible à la vente"
        checked={option.available}
        onChange={(available) => onUpdate({ available })}
      />

      {error && (
        <p id={`${id}-error`} className="text-xs text-destructive">
          {error}
        </p>
      )}
    </Reorder.Item>
  );
}

// ─── Fragments partagés ───────────────────────────────────────────────────────

/**
 * Interrupteur sur une ligne bordée : la bordure donne une cible tactile large,
 * là où la case à cocher native précédente faisait 13 px. `Label` et `Switch`
 * sont FRÈRES — imbriquer un `Switch` (un `<button role="switch">`) dans un
 * `<label>` provoquerait une double bascule.
 */
function ToggleRow({
  id,
  label,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-3 rounded-md border bg-background px-3 py-2 sm:min-h-9">
      <Label htmlFor={id} className="cursor-pointer font-normal">
        {label}
      </Label>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

/** Chevron du repli. Inline pour éviter un import de plus. */
function ChevronRightIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-4"
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}
