import type { SupplementKind } from '@/config/menu-types';

/**
 * Étiquette « Goût » d'un groupe dans les sélecteurs (public et caisse). Rien
 * n'est affiché pour un supplément : c'est le cas ordinaire, l'étiqueter sur
 * chaque groupe ne dirait rien.
 */
export function SupplementKindBadge({ kind }: { kind?: SupplementKind }) {
  if (kind !== 'flavor') return null;
  return (
    <span className="ml-1.5 rounded-full bg-primary/10 px-1.5 py-0.5 align-middle text-[10px] font-semibold uppercase tracking-wide text-primary">
      Goût
    </span>
  );
}
