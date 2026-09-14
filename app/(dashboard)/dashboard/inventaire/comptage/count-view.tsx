'use client';

// La session de comptage.
//
// Elle a sa propre route, comme `caisse/new` et `depenses/nouvelle` : c'est une
// saisie longue (117 références, une vingtaine de minutes), qui a besoin de tout
// l'écran et d'une barre d'action fixe. Dans l'onglet, elle était précédée de 4
// KPI, d'une carte d'alerte, d'une barre d'outils et d'une barre d'onglets — la
// première référence à compter tombait sous la ligne de flottaison du téléphone.
//
// Le volume ne se combat pas en rendant le geste moins cher (il l'est déjà : un
// appui), mais en réduisant N. D'où les puces de zone : on compte une étagère,
// on valide, on passe à la suivante. 117 références deviennent six passages
// d'une vingtaine.

import { useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, ClipboardList, Search } from 'lucide-react';

import type { InventoryItemView } from '@/lib/inventory';
import { todayDateString } from '@/lib/timezone';
import { createFuzzyIndex } from '@/lib/fuzzy-search';
import {
  countEntered,
  draftToLines,
  parseCountValue,
} from '@/lib/inventory-count-draft';
import {
  useInventoryCountHydration,
  useInventoryCountStore,
} from '@/lib/hooks/use-inventory-count';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';

import { recordInventoryCountAction } from '../actions';
import { CountCard } from './_components/count-card';
import { CountBottomBar } from './_components/count-bottom-bar';
import { CountRecapSheet } from './_components/count-recap-sheet';
import { DraftBanner } from './_components/draft-banner';

const UNCATEGORIZED = 'Sans catégorie';
const EMPTY_COUNTS: Record<string, string> = {};

type Filter = 'all' | 'todo' | 'diff';

export function CountView({ items }: { items: InventoryItemView[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const hasHydrated = useInventoryCountHydration();
  const draft = useInventoryCountStore((s) => s.draft);
  const start = useInventoryCountStore((s) => s.start);
  const setCount = useInventoryCountStore((s) => s.setCount);
  const clear = useInventoryCountStore((s) => s.clear);

  const [search, setSearch] = useState('');
  const [zone, setZone] = useState<string>('all');
  const [filter, setFilter] = useState<Filter>('todo');
  const [recapOpen, setRecapOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Instantané des saisies au moment du DERNIER geste de sélection.
  //
  // C'est ce qui empêche la liste de se recomposer sous le pouce : avec le
  // filtre « À compter », une carte qui disparaît à la seconde où on tape son
  // chiffre fait remonter la suivante sous le doigt, et casse l'enchaînement au
  // clavier en plein milieu. La sélection ne bouge donc que sur un geste
  // explicite — changer de zone, de filtre ou de recherche.
  const [snapshot, setSnapshot] = useState<Record<string, string>>({});

  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  // Identité stable : `draft?.counts ?? {}` recrée un objet vide à chaque rendu
  // et ferait recalculer les compteurs de zone pour rien.
  const counts = useMemo(() => draft?.counts ?? EMPTY_COUNTS, [draft]);
  const entered = countEntered(counts);

  // Tri par catégorie puis nom : c'est l'ordre dans lequel on marche dans la
  // réserve, et celui que `listInventoryItems` renvoie déjà.
  const sorted = useMemo(
    () =>
      [...items].sort((a, b) => {
        const byCat = (a.category ?? UNCATEGORIZED).localeCompare(
          b.category ?? UNCATEGORIZED,
          'fr'
        );
        return byCat !== 0 ? byCat : a.name.localeCompare(b.name, 'fr');
      }),
    [items]
  );

  const zones = useMemo(() => {
    const byZone = new Map<string, { total: number; done: number }>();
    for (const item of sorted) {
      const key = item.category ?? UNCATEGORIZED;
      const acc = byZone.get(key) ?? { total: 0, done: 0 };
      acc.total++;
      if (parseCountValue(counts[item.id]) !== null) acc.done++;
      byZone.set(key, acc);
    }
    return Array.from(byZone, ([name, stats]) => ({ name, ...stats }));
  }, [sorted, counts]);

  // Recherche floue partagée : un `includes()` maison ne trouve pas « Café »
  // quand on tape « cafe », et impose l'ordre des mots (CLAUDE.md).
  const index = useMemo(
    () =>
      createFuzzyIndex(sorted, {
        keys: [
          { name: 'name' },
          { name: 'sku', weight: 0.5 },
          { name: 'category', weight: 0.3 },
        ],
      }),
    [sorted]
  );

  const visible = useMemo(() => {
    const query = search.trim();
    const base =
      query === '' ? sorted : index.search(query).map((hit) => hit.item);
    return base.filter((item) => {
      if (zone !== 'all' && (item.category ?? UNCATEGORIZED) !== zone) {
        return false;
      }
      const counted = parseCountValue(snapshot[item.id]);
      if (filter === 'todo' && counted !== null) return false;
      if (
        filter === 'diff' &&
        (counted === null || counted === item.currentQuantity)
      ) {
        return false;
      }
      return true;
    });
  }, [sorted, index, search, zone, filter, snapshot]);

  /** Tout changement de sélection re-photographie les saisies du moment. */
  function selectZone(next: string) {
    setSnapshot(counts);
    setZone(next);
  }
  function selectFilter(next: Filter) {
    setSnapshot(counts);
    setFilter(next);
  }
  function selectSearch(next: string) {
    setSnapshot(counts);
    setSearch(next);
  }

  function focusNext(index_: number) {
    for (let i = index_ + 1; i < inputRefs.current.length; i++) {
      const el = inputRefs.current[i];
      if (el) {
        el.focus();
        el.select();
        return;
      }
    }
  }

  function handleSubmit() {
    if (!draft) return;
    setError(null);
    const lines = draftToLines(
      draft.counts,
      sorted.map((it) => it.id)
    );
    if (lines.length === 0) return;

    startTransition(async () => {
      const result = await recordInventoryCountAction({
        date: draft.date,
        label: draft.label.trim() || undefined,
        lines,
      });
      if (result.ok) {
        // Le brouillon n'est vidé qu'après confirmation du serveur : un échec
        // réseau dans la réserve est précisément le moment où il sert.
        clear();
        setRecapOpen(false);
        router.push('/dashboard/inventaire?compte=1');
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  if (!hasHydrated) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border p-10 text-center">
        <ClipboardList className="size-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Aucune référence active à compter. Ajoutez d&apos;abord des articles à
          l&apos;inventaire.
        </p>
      </div>
    );
  }

  if (!draft) {
    return (
      <StartPanel
        total={items.length}
        onStart={() =>
          start(
            todayDateString(),
            items.map((it) => it.id)
          )
        }
      />
    );
  }

  return (
    <div className="space-y-4 pb-28">
      <DraftBanner draft={draft} items={items} />

      {/* Barre de travail. Elle reste à l'écran pendant tout le comptage : elle
          est donc tenue au strict nécessaire — sur 844 px de haut, chaque ligne
          gagnée est une référence de plus visible. */}
      <div className="sticky top-0 z-10 -mx-4 space-y-2 border-b bg-background/95 px-4 py-2 backdrop-blur sm:-mx-6 sm:px-6">
        <Progress entered={entered} total={items.length} />

        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Rechercher une référence"
            value={search}
            onChange={(e) => selectSearch(e.target.value)}
            className="h-10 pl-8"
            aria-label="Rechercher une référence"
          />
        </div>

        {/* Filtres puis zones sur une seule ligne défilante : les trois filtres
            restent visibles sans geste, les zones se parcourent au pouce. */}
        <div className="-mx-4 overflow-x-auto px-4 sm:-mx-6 sm:px-6">
          <div className="flex w-max items-center gap-1.5">
            <Chip
              active={filter === 'todo'}
              onClick={() => selectFilter('todo')}
              label="À compter"
            />
            <Chip
              active={filter === 'diff'}
              onClick={() => selectFilter('diff')}
              label="Écarts"
            />
            <Chip
              active={filter === 'all'}
              onClick={() => selectFilter('all')}
              label="Toutes"
            />

            <span aria-hidden className="mx-1 h-6 w-px shrink-0 bg-border" />

            <Chip
              active={zone === 'all'}
              onClick={() => selectZone('all')}
              label="Toutes zones"
            />
            {zones.map((z) => (
              <Chip
                key={z.name}
                active={zone === z.name}
                onClick={() => selectZone(z.name)}
                label={`${z.name} ${z.done}/${z.total}`}
                done={z.done === z.total}
              />
            ))}
          </div>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          <AlertCircle className="size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {visible.length === 0 ? (
        <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          {filter === 'todo'
            ? 'Tout est compté dans cette sélection.'
            : 'Aucune référence ne correspond.'}
        </p>
      ) : (
        <div className="space-y-2">
          {visible.map((item, i) => (
            <CountCard
              key={item.id}
              item={item}
              raw={counts[item.id] ?? ''}
              counted={parseCountValue(counts[item.id])}
              moved={
                draft.systemAt[item.id] !== undefined &&
                draft.systemAt[item.id] !== item.currentQuantity
              }
              onChange={(raw) => setCount(item.id, raw, item.currentQuantity)}
              inputRef={(el) => {
                inputRefs.current[i] = el;
              }}
              onEnter={() => focusNext(i)}
            />
          ))}
        </div>
      )}

      <CountBottomBar
        entered={entered}
        total={items.length}
        disabled={entered === 0 || isPending}
        onValidate={() => setRecapOpen(true)}
      />

      <CountRecapSheet
        open={recapOpen}
        onClose={() => setRecapOpen(false)}
        draft={draft}
        items={sorted}
        isPending={isPending}
        error={error}
        onConfirm={handleSubmit}
        onSeeRemaining={() => {
          setRecapOpen(false);
          selectZone('all');
          selectFilter('todo');
        }}
      />
    </div>
  );
}

function Progress({ entered, total }: { entered: number; total: number }) {
  const pct = total === 0 ? 0 : Math.round((entered / total) * 100);
  return (
    <div>
      <div className="flex items-baseline justify-between text-sm">
        <span className="font-medium tabular-nums" aria-live="polite">
          {entered} / {total} comptées
        </span>
        <span className="text-xs text-muted-foreground tabular-nums">
          {pct} %
        </span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-300 motion-reduce:transition-none"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function Chip({
  active,
  onClick,
  label,
  done,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  done?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'h-10 shrink-0 rounded-full border px-3.5 text-sm font-medium whitespace-nowrap transition-colors hover:bg-muted',
        active &&
          'border-primary bg-primary/10 text-primary hover:bg-primary/15',
        !active && done && 'text-muted-foreground'
      )}
    >
      {label}
    </button>
  );
}

function StartPanel({
  total,
  onStart,
}: {
  total: number;
  onStart: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-xl border p-8 text-center">
      <ClipboardList className="size-8 text-muted-foreground" />
      <div>
        <p className="font-medium">{total} références à compter</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Votre saisie est conservée sur cet appareil : vous pouvez verrouiller
          le téléphone et reprendre plus tard.
        </p>
      </div>
      <button
        type="button"
        onClick={onStart}
        className="h-11 rounded-md bg-primary px-6 font-medium text-primary-foreground transition-opacity hover:opacity-90"
      >
        Commencer le comptage
      </button>
    </div>
  );
}
