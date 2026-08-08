// lib/supplements.ts
//
// Logique pure partagée par les deux interfaces de sélection de suppléments
// (caisse : `app/(dashboard)/dashboard/caisse/new/supplement-picker.tsx` et
// site public : `components/(public)/carte/supplement-modal.tsx`), pour éviter
// de dupliquer les règles de validation (min/max, quantité par option) entre
// les deux composants.
//
// Un groupe a trois types :
//   - 'single'   : un seul choix (radio). minSelect/maxSelect ignorés.
//   - 'multiple' : cases à cocher, chaque option 0 ou 1 fois. minSelect/
//                  maxSelect bornent le NOMBRE d'options cochées.
//   - 'quantity' : chaque option a un compteur (0..N). minSelect/maxSelect
//                  bornent la SOMME des quantités (ex. répartir 3 parts entre
//                  3 goûts : minSelect = maxSelect = 3).

import type { Product, SupplementGroup } from '@/config/menu';
import type { CartItemSupplement } from '@/lib/cart-store';
import {
  formatLocalDateOnly,
  getAbidjanWeekday,
  shiftDateString,
} from '@/lib/timezone';

/**
 * Un produit en pause programmée (`unavailableUntil` dans le futur) est
 * toujours visible sur la carte/le dashboard (pas de masquage dur) mais non
 * commandable. La reprise est calculée à la LECTURE (pas de cron) : dès que
 * `now` dépasse `unavailableUntil`, le produit redevient commandable sans
 * intervention. Client-safe (pas d'import Prisma) : utilisable depuis les
 * composants client (dashboard ET carte publique).
 */
export function isPausedNow(
  unavailableUntil: Date | string | null | undefined,
  now: Date = new Date()
): boolean {
  if (!unavailableUntil) return false;
  const until =
    typeof unavailableUntil === 'string'
      ? new Date(unavailableUntil)
      : unavailableUntil;
  return until.getTime() > now.getTime();
}

/**
 * Planning récurrent (`Product.availableDays`/`MenuCategory.availableDays`,
 * résolu à la lecture par `lib/menu.ts` depuis les plannings `ProductSchedule`
 * assignés — voir `intersectAvailableDays`). Convention IMPORTANTE : `null`/
 * absent = pas de restriction (tous les jours) ; un tableau MÊME VIDE = jour(s)
 * explicitement restreints (`[]` = jamais disponible, cas d'une intersection
 * produit×catégorie sans jour commun — on signale honnêtement l'impossibilité
 * plutôt que de retomber silencieusement sur « tous les jours »).
 */
export function isAvailableToday(
  availableDays: number[] | null | undefined,
  now: Date = new Date()
): boolean {
  if (availableDays == null) return true;
  return availableDays.includes(getAbidjanWeekday(now));
}

/**
 * Fenêtres « spécialité de la semaine » (`Product.weeklySpecialPeriods`). Dès
 * qu'au moins une fenêtre existe pour un produit, il n'est commandable QUE
 * dans une fenêtre active — en dehors, `false` (produit visible mais non
 * commandable, comme une pause). Vide/absent = pas de restriction.
 */
export function isWithinAnyPeriod(
  periods: { startDate: string; endDate: string }[] | null | undefined,
  now: Date = new Date()
): boolean {
  if (!periods || periods.length === 0) return true;
  const today = formatLocalDateOnly(now);
  return periods.some((p) => p.startDate <= today && today <= p.endDate);
}

/**
 * Vrai si le produit peut être mis au panier MAINTENANT : ni épuisé, ni en
 * pause, ni hors de son planning hebdomadaire, ni hors d'une fenêtre
 * « spécialité de la semaine ».
 *
 * Source unique de cette conjonction, partagée par les surfaces qui décident
 * quoi mettre en avant (vitrine de la carte, vitrine de l'accueil) et par le
 * geste d'ajout lui-même (`useQuickAdd`). Ce dernier garde ses drapeaux
 * détaillés pour les libellés — un produit non commandable reste VISIBLE avec
 * son motif — mais la règle « peut-on l'ajouter ? » se lit ici.
 *
 * Garde-fou d'interface uniquement : la vérité stock reste le PAIEMENT
 * (lib/order-mutations.ts).
 */
export function isOrderableNow(product: Product, now: Date = new Date()) {
  return (
    product.soldOut !== true &&
    !isPausedNow(product.unavailableUntil, now) &&
    isAvailableToday(product.availableDays, now) &&
    isWithinAnyPeriod(product.weeklySpecialPeriods, now)
  );
}

/**
 * Vrai si `pickupDate` respecte le délai minimum de commande à l'avance
 * (`advanceOrderDays`, résolu par `effectiveAdvanceOrderDays`, lib/menu.ts).
 * `null`/absent/0 = pas de contrainte. La comparaison se fait en JOURS CIVILS
 * Abidjan (comme `Order.dailyDate`) : commander AUJOURD'HUI pour un retrait
 * dans J+advanceOrderDays jours civils (ou plus tard) est autorisé. Un
 * retrait « dès que possible » (pas de date choisie) ne peut jamais
 * satisfaire une contrainte existante — il faut une date choisie et
 * suffisamment lointaine.
 */
export function isPickupDateAllowed(
  advanceOrderDays: number | null | undefined,
  pickupDate: Date | string | null | undefined,
  now: Date = new Date()
): boolean {
  if (!advanceOrderDays) return true;
  if (!pickupDate) return false;
  const pickupStr =
    typeof pickupDate === 'string'
      ? formatLocalDateOnly(new Date(pickupDate))
      : formatLocalDateOnly(pickupDate);
  return (
    pickupStr >= shiftDateString(formatLocalDateOnly(now), advanceOrderDays)
  );
}

/** Date civile (YYYY-MM-DD, Abidjan) la plus proche satisfaisant un délai de
 * commande à l'avance donné. */
export function minAllowedPickupDateString(
  advanceOrderDays: number,
  now: Date = new Date()
): string {
  return shiftDateString(formatLocalDateOnly(now), advanceOrderDays);
}

/**
 * Prochaine fenêtre « spécialité de la semaine » à venir (pour le badge
 * « Revient le … »), ou `null` si aucune n'est programmée.
 */
export function nextUpcomingPeriod(
  periods: { startDate: string; endDate: string }[] | null | undefined,
  now: Date = new Date()
): { startDate: string; endDate: string } | null {
  const today = formatLocalDateOnly(now);
  return (
    (periods ?? [])
      .filter((p) => p.startDate > today)
      .sort((a, b) => a.startDate.localeCompare(b.startDate))[0] ?? null
  );
}

/** Sélection pour un groupe : nom d'option ('single'), noms cochés
 * ('multiple'), ou quantité par nom d'option ('quantity'). */
export type GroupSelection = string | string[] | Record<string, number>;
export type Selections = Record<string, GroupSelection>;

export function buildInitialSelections(
  product: Product | null,
  initial: CartItemSupplement[]
): Selections {
  const out: Selections = {};
  (product?.supplements ?? []).forEach((group) => {
    const picked = initial.filter((s) => s.groupName === group.name);
    if (group.type === 'single') {
      out[group.name] = picked[0]?.optionName ?? '';
    } else if (group.type === 'multiple') {
      out[group.name] = picked.map((s) => s.optionName);
    } else {
      const qty: Record<string, number> = {};
      picked.forEach((s) => {
        qty[s.optionName] = s.quantity ?? 1;
      });
      out[group.name] = qty;
    }
  });
  return out;
}

/** Nombre de sélections pour un groupe : options cochées ('multiple') ou
 * somme des quantités ('quantity'). Toujours 0 ou 1 pour 'single'. Une option
 * épuisée (`soldOut`) n'est jamais comptée, même si elle apparaît encore dans
 * `selections` (ex. stock qui s'épuise pendant que le modal est ouvert). */
export function groupSelectionCount(
  group: SupplementGroup,
  selections: Selections
): number {
  const sel = selections[group.name];
  if (group.type === 'single') {
    return typeof sel === 'string' && sel !== '' && !isOptionSoldOut(group, sel)
      ? 1
      : 0;
  }
  if (group.type === 'multiple') {
    if (!Array.isArray(sel)) return 0;
    return sel.filter((name) => !isOptionSoldOut(group, name)).length;
  }
  const qty = (sel as Record<string, number>) ?? {};
  return Object.entries(qty).reduce(
    (s, [name, n]) => (isOptionSoldOut(group, name) ? s : s + n),
    0
  );
}

/** Options cochées pour un groupe 'multiple', sous forme de tableau sûr.
 * `selections[group.name]` peut être autre chose qu'un tableau si deux
 * groupes distincts partagent le même nom (ex. un groupe propre au produit et
 * un extra global tous deux nommés « Lait végétal ») — auquel cas la dernière
 * écriture dans `buildInitialSelections`/les handlers de sélection peut y
 * avoir placé une chaîne ('single') ou un objet de quantités ('quantity'). On
 * traite alors le groupe comme vide plutôt que de planter sur `.includes`. */
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

/** Borne effective : `required` sert de minimum implicite (1) quand
 * `minSelect` n'est pas explicitement configuré — compatible avec les
 * groupes existants qui n'utilisaient que `required`. */
export function effectiveMin(group: SupplementGroup): number {
  if (group.minSelect != null) return group.minSelect;
  return group.required ? 1 : 0;
}

export function effectiveMax(group: SupplementGroup): number {
  if (group.type === 'single') return 1;
  return group.maxSelect ?? Infinity;
}

/** Une option épuisée (stock 0) ne peut jamais être comptée/soumise — même si
 * elle apparaît encore sélectionnée dans un état antérieur (ex. stock qui
 * s'épuise pendant que le modal est ouvert). `soldOut` absent = jamais épuisé
 * (illimité ou stock non suivi). */
function isOptionSoldOut(group: SupplementGroup, optionName: string): boolean {
  return group.options.find((o) => o.name === optionName)?.soldOut === true;
}

export function isGroupValid(
  group: SupplementGroup,
  selections: Selections
): boolean {
  if (group.type === 'single') {
    const sel = selections[group.name];
    const hasSelection = typeof sel === 'string' && sel !== '';
    // Une sélection sur une option devenue épuisée ne compte pas : un groupe
    // requis dont le seul choix viable est épuisé reste bloqué par le message
    // « requis » existant (aucune sélection valide n'est retenue).
    if (hasSelection && isOptionSoldOut(group, sel)) return !group.required;
    if (!group.required) return true;
    return hasSelection;
  }
  const count = groupSelectionCount(group, selections);
  return count >= effectiveMin(group) && count <= effectiveMax(group);
}

export function canSubmitSelections(
  product: Product,
  selections: Selections
): boolean {
  return (product.supplements ?? []).every((g) => isGroupValid(g, selections));
}

/** Convertit l'état de sélection en suppléments prêts pour le panier. */
export function getSelectedSupplements(
  product: Product,
  selections: Selections
): CartItemSupplement[] {
  const result: CartItemSupplement[] = [];
  (product.supplements ?? []).forEach((group) => {
    const sel = selections[group.name];
    if (group.type === 'single') {
      if (typeof sel === 'string' && sel && !isOptionSoldOut(group, sel)) {
        const opt = group.options.find((o) => o.name === sel);
        if (opt) {
          result.push({
            groupName: group.name,
            optionName: opt.name,
            price: opt.price,
          });
        }
      }
    } else if (group.type === 'multiple') {
      if (Array.isArray(sel)) {
        sel.forEach((name) => {
          if (isOptionSoldOut(group, name)) return;
          const opt = group.options.find((o) => o.name === name);
          if (opt) {
            result.push({
              groupName: group.name,
              optionName: opt.name,
              price: opt.price,
            });
          }
        });
      }
    } else {
      const qty = (sel as Record<string, number>) ?? {};
      group.options.forEach((opt) => {
        if (opt.soldOut) return;
        const n = qty[opt.name] ?? 0;
        if (n > 0) {
          result.push({
            groupName: group.name,
            optionName: opt.name,
            price: opt.price,
            quantity: n,
          });
        }
      });
    }
  });
  return result;
}

export function getSupplementsPrice(supplements: CartItemSupplement[]): number {
  return supplements.reduce((sum, s) => sum + s.price * (s.quantity ?? 1), 0);
}

/** Libellé d'aide affiché sous le nom du groupe (ex. « Choisissez entre 1 et
 * 3 » ou « Répartissez exactement 3 »). `null` = rien à afficher. */
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

// ─── Boîtes à parts fixes (ex. « Sponge Cake x4 ») ──────────────────────────
//
// Cas particulier d'un groupe 'quantity' dont les bornes sont ÉGALES : le
// produit est un contenant d'exactement N parts, et le client répartit ces N
// parts entre les goûts. Le nombre de parts est une propriété du PRODUIT (une
// boîte fait toujours 4, une autre référence pourra en faire 3 ou 6) — jamais
// un choix du client, qui ne décide que du remplissage.
//
// L'interface publique s'en sert pour basculer d'une liste de compteurs vers un
// composeur à emplacements (`_components/portion-composer.tsx`).

/** Vrai si le groupe décrit une boîte de N parts à répartir exactement. */
export function isFixedPortionGroup(group: SupplementGroup): boolean {
  if (group.type !== 'quantity') return false;
  const max = effectiveMax(group);
  return Number.isFinite(max) && max > 0 && effectiveMin(group) === max;
}

/** Nombre de parts de la boîte. N'a de sens que sur un groupe à parts fixes. */
export function portionCount(group: SupplementGroup): number {
  return effectiveMax(group);
}

/**
 * Emplacements de la boîte, dans l'ordre des options du groupe : le nom du goût
 * pour une case remplie, `null` pour une case libre. Toujours `portionCount`
 * entrées.
 *
 * Les cases sont DÉRIVÉES des compteurs, elles ne sont pas un état séparé :
 * une boîte « 2 Oreo + 2 Kinder » est la même quel que soit l'ordre de saisie,
 * et le modèle de données (`Record<goût, quantité>`) reste donc inchangé — rien
 * à modifier côté panier, commande ou caisse.
 */
export function portionSlots(
  group: SupplementGroup,
  selections: Selections
): (string | null)[] {
  const counts = (selections[group.name] as Record<string, number>) ?? {};
  const filled = group.options.flatMap((opt) =>
    Array.from({ length: Math.max(0, counts[opt.name] ?? 0) }, () => opt.name)
  );
  const size = portionCount(group);
  return [
    ...filled.slice(0, size),
    ...Array.from({ length: Math.max(0, size - filled.length) }, () => null),
  ];
}

/**
 * Nom du groupe débarrassé d'un suffixe « (N parts) » saisi à la main. Le
 * nombre de parts affiché doit venir des bornes du groupe, pas d'un libellé
 * libre : en production les deux ont divergé (groupe nommé « (3 parts) » sur un
 * produit « x4 » borné à 4), et le client voyait un chiffre faux.
 */
export function stripPortionSuffix(name: string): string {
  return name.replace(/\s*\(\s*\d+\s*parts?\s*\)\s*$/i, '').trim() || name;
}
