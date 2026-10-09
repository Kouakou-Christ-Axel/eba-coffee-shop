import type { Product, SupplementGroup } from '@/config/menu';

export type GroupSelection = string | string[] | Record<string, number>;

export type Selections = Record<string, GroupSelection>;

/** `ignoreSoldOut` : sans lui, un goût épuisé est retiré SILENCIEUSEMENT de la sélection. */
export type SupplementRules = { ignoreSoldOut?: boolean };

export function groupSelectionCount(
  group: SupplementGroup,
  selections: Selections,
  rules?: SupplementRules
): number {
  const sel = selections[group.name];
  const soldOut = (name: string) => isOptionSoldOut(group, name, rules);
  if (group.type === 'single') {
    return typeof sel === 'string' && sel !== '' && !soldOut(sel) ? 1 : 0;
  }
  if (group.type === 'multiple') {
    if (!Array.isArray(sel)) return 0;
    return sel.filter((name) => !soldOut(name)).length;
  }
  const qty = (sel as Record<string, number>) ?? {};
  return Object.entries(qty).reduce(
    (s, [name, n]) => (soldOut(name) ? s : s + n),
    0
  );
}

/** Options cochées pour un groupe 'multiple', sous forme de tableau sûr. */
export function multipleSelection(
  selections: Selections,
  groupName: string
): string[] {
  const sel = selections[groupName];
  return Array.isArray(sel) ? sel : [];
}

/** Quantité choisie pour une option précise (groupe type 'quantity'). */
export function optionQuantity(
  group: SupplementGroup,
  selections: Selections,
  optionName: string
): number {
  const sel = selections[group.name] as Record<string, number> | undefined;
  return sel?.[optionName] ?? 0;
}

export function effectiveMin(group: SupplementGroup): number {
  if (group.minSelect != null) return group.minSelect;
  return group.required ? 1 : 0;
}

export function effectiveMax(group: SupplementGroup): number {
  if (group.type === 'single') return 1;
  return group.maxSelect ?? Infinity;
}

/** Option épuisée, sauf si `rules.ignoreSoldOut`. */
export function isOptionSoldOut(
  group: SupplementGroup,
  optionName: string,
  rules?: SupplementRules
): boolean {
  if (rules?.ignoreSoldOut) return false;
  return group.options.find((o) => o.name === optionName)?.soldOut === true;
}

export function isGroupValid(
  group: SupplementGroup,
  selections: Selections,
  rules?: SupplementRules
): boolean {
  if (group.type === 'single') {
    const sel = selections[group.name];
    const hasSelection = typeof sel === 'string' && sel !== '';
    if (hasSelection && isOptionSoldOut(group, sel, rules)) {
      return !group.required;
    }
    if (!group.required) return true;
    return hasSelection;
  }
  const count = groupSelectionCount(group, selections, rules);
  return count >= effectiveMin(group) && count <= effectiveMax(group);
}

export function canSubmitSelections(
  product: Product,
  selections: Selections,
  rules?: SupplementRules
): boolean {
  return (product.supplements ?? []).every((g) =>
    isGroupValid(g, selections, rules)
  );
}

/** Libellé d'aide affiché sous le nom du groupe. */
export function groupConstraintLabel(group: SupplementGroup): string | null {
  const min = effectiveMin(group);
  const max = group.type === 'single' ? 1 : (group.maxSelect ?? null);

  if (group.type === 'quantity') {
    if (max != null && max === min) return `Répartissez exactement ${max}`;
    if (max != null) return `Répartissez entre ${min} et ${max}`;
    return min > 0 ? `Répartissez au moins ${min}` : null;
  }
  if (group.type === 'multiple') {
    if (max != null && max === min && min > 0)
      return `Choisissez exactement ${max}`;
    if (max != null) return `Choisissez jusqu'à ${max}`;
    return null;
  }
  return null;
}
