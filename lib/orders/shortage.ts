// lib/orders/shortage.ts
//
// Vocabulaire de la PÉNURIE, partagé serveur ↔ client. Fichier PUR (aucun
// Prisma, aucun React) : le calcul vit dans `lib/order-mutations.ts`, mais son
// résultat traverse jusqu'aux écrans caisse et cuisine, qui doivent pouvoir le
// typer et le formater sans embarquer le client Prisma dans leur bundle.
//
// Pourquoi ce vocabulaire existe : jusqu'ici, un stock insuffisant renvoyait un
// simple message d'erreur, et le staff devait aller corriger la quantité dans
// /dashboard/menu avant de pouvoir lancer la commande. Or le cuisinier a la
// fournée devant lui. En transportant la liste CHIFFRÉE des manques jusqu'à
// l'écran, on peut lui poser la vraie question — « vous les avez produits ? » —
// et enregistrer la production sur place.

/** Une ligne de manque, telle qu'on la montre à l'écran. */
export type ShortageLine = {
  target: 'product' | 'option';
  /** Id de la ligne à créditer : `Product.id` ou `SupplementOption.id` selon
   * `target`. Un seul champ plutôt qu'un `productId`/`optionId` mutuellement
   * exclusifs — la couverture ne s'en sert que pour viser la bonne table. */
  targetId: string;
  productName: string;
  /** Renseignés uniquement pour `target: 'option'`. */
  groupName?: string;
  optionName?: string;
  /** Quantité à produire pour honorer la commande. Toujours > 0. */
  missing: number;
};

/** Libellé d'une ligne : « Sponge cake (Vanille) ». */
export function formatShortageLine(line: ShortageLine): string {
  return line.optionName
    ? `${line.productName} (${line.optionName})`
    : line.productName;
}

/** Liste à puces des manques, une ligne par cible : « 3 × Sponge cake (Vanille) ». */
export function formatShortageList(lines: ShortageLine[]): string {
  return lines
    .map((line) => `• ${line.missing} × ${formatShortageLine(line)}`)
    .join('\n');
}
