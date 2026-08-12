/**
 * Hauteur d'un graphe en barres horizontales : une ligne par entrée, avec un
 * plancher pour qu'une ou deux barres ne donnent pas une carte écrasée.
 *
 * Vit dans le wrapper (et non dans l'implémentation) : c'est lui qui réserve
 * la boîte, dès le placeholder, pour que l'arrivée du graphe ne décale rien.
 * L'implémentation se contente de remplir cette boîte.
 */
export function barListHeight(
  count: number,
  { min, step }: { min: number; step: number }
): number {
  return Math.max(min, count * step);
}
