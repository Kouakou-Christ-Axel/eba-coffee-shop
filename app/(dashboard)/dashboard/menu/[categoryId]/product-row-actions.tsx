'use client';

import { Loader2, Star } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { ConfirmDialog } from '@/components/(dashboard)/confirm-dialog';
import { RestockInline } from './_components/row-actions/restock-inline';
import { RowActionsMenu } from './_components/row-actions/row-actions-menu';
import { useRowActions } from './_components/row-actions/use-row-actions';

export function ProductRowActions({
  id,
  name,
  available,
  featured,
  stockQuantity,
  isFirst,
  isLast,
  /** Le tri par flèches porte sur la liste COMPLÈTE : le proposer sur une liste
   * filtrée ferait déplacer le produit par rapport à des voisins invisibles. */
  canReorder,
  statsHref,
}: {
  id: string;
  name: string;
  available: boolean;
  featured: boolean;
  /** `null` = stock illimité : le réappro (« + fournée ») n'a pas de sens. */
  stockQuantity: number | null;
  isFirst: boolean;
  isLast: boolean;
  canReorder: boolean;
  /** Fiche produit ouverte directement sur l'onglet « Statistiques ». */
  statsHref: string;
}) {
  const actions = useRowActions({ id, name, available, featured });
  const {
    isPending,
    isRestockOpen,
    confirmDelete,
    setConfirmDelete,
    optimisticAvailable,
    optimisticFeatured,
    toggleFeatured,
    toggleAvailable,
    handleDelete,
  } = actions;

  return (
    <div className="flex items-center justify-end gap-2 sm:gap-3">
      <div
        className="hidden items-center gap-1.5 sm:flex"
        title="Afficher dans les incontournables de la page d'accueil"
      >
        <Star
          className={`size-4 ${optimisticFeatured ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground'}`}
        />
        <Switch
          checked={optimisticFeatured}
          disabled={isPending}
          onCheckedChange={toggleFeatured}
          aria-label="Mettre en avant"
        />
      </div>

      <Switch
        checked={optimisticAvailable}
        disabled={isPending}
        onCheckedChange={toggleAvailable}
        aria-label="Disponibilité"
      />

      {isPending && (
        <Loader2
          className="size-4 shrink-0 animate-spin text-muted-foreground"
          aria-hidden="true"
        />
      )}

      {stockQuantity !== null && isRestockOpen ? (
        <RestockInline actions={actions} />
      ) : (
        <RowActionsMenu
          actions={actions}
          name={name}
          stockQuantity={stockQuantity}
          isFirst={isFirst}
          isLast={isLast}
          canReorder={canReorder}
          statsHref={statsHref}
        />
      )}

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Supprimer « ${name} » ?`}
        description="Le produit disparaîtra de la carte et du dashboard. Les commandes passées le conservent."
        confirmLabel="Supprimer"
        destructive
        isPending={isPending}
        onConfirm={handleDelete}
      />
    </div>
  );
}
