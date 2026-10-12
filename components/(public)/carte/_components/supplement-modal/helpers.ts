import { priceFormatter, type SupplementGroup } from '@/config/menu';

/** Options épuisées reléguées en fin de groupe : elles restent consultables
 * (le client voit que le goût existe) sans encombrer les choix disponibles. */
export function orderableFirst(options: SupplementGroup['options']) {
  return [...options].sort(
    (a, b) => Number(a.soldOut ?? false) - Number(b.soldOut ?? false)
  );
}

/** Aperçu vendeur des extras : « Chantilly +300 F · Shot espresso +300 F ».
 * Le repli des extras répond à un vrai problème (listes trop longues pour
 * finir une commande) — mais un bouton muet ne vend rien. On garde le repli
 * et on montre le contenu. */
export function extrasPreview(groups: SupplementGroup[], max = 3): string {
  return groups
    .flatMap((g) => g.options)
    .filter((o) => !o.soldOut && o.price > 0)
    .slice(0, max)
    .map((o) => `${o.name} +${priceFormatter.format(o.price)} F`)
    .join(' · ');
}
