// État vide de la liste des commandes.
//
// L'ancienne version était une phrase nue. Or la plage par défaut est
// *aujourd'hui* : ouvrir /commandes à 8 h affichait « Aucune commande pour
// cette sélection », ce qui se lit comme une panne. On distingue donc « rien
// sur la période » d'« aucun résultat pour cette recherche », et on offre une
// sortie quand des filtres sont posés.
//
// Composant serveur : de simples liens suffisent (la navigation par filtres
// passe par l'URL). `useOrdersNav` n'est de toute façon disponible que dans
// `<OrdersToolbar>`.

import Link from 'next/link';
import { Inbox, SearchX } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function OrdersEmptyState({
  hasSearch,
  hasFilters,
}: {
  /** Une recherche textuelle est active. */
  hasSearch: boolean;
  /** Un filtre (statut, paiement, plage non par défaut) est actif. */
  hasFilters: boolean;
}) {
  const Icon = hasSearch ? SearchX : Inbox;

  return (
    <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
      <Icon className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
      <p className="text-sm font-medium">
        {hasSearch
          ? 'Aucune commande ne correspond à cette recherche.'
          : 'Aucune commande sur cette période.'}
      </p>
      <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
        <Button variant="outline" size="sm" asChild>
          <Link href="/dashboard/commandes?range=all">
            Voir tout l’historique
          </Link>
        </Button>
        {(hasSearch || hasFilters) && (
          <Button variant="ghost" size="sm" asChild>
            <Link href="/dashboard/commandes">Réinitialiser les filtres</Link>
          </Button>
        )}
      </div>
    </div>
  );
}
