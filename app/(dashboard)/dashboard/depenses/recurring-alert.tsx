import Link from 'next/link';
import { BellRing } from 'lucide-react';
import { Button } from '@/components/ui/button';

type Missing = {
  id: string;
  label: string;
  categoryId: string;
  categoryName: string;
  expectedAmount: number | null;
};

/**
 * Bandeau d'alerte listant les dépenses récurrentes non saisies ce mois-ci.
 * Un clic ouvre la page de saisie pré-remplie d'après le modèle (catégorie,
 * montant attendu, libellé en note) — cf. `nouvelle/page.tsx`, qui résout
 * `?recurrent=<id>` côté serveur plutôt que de faire transiter les valeurs
 * dans l'URL.
 */
export function RecurringAlert({ missing }: { missing: Missing[] }) {
  if (missing.length === 0) return null;

  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-900/60 dark:bg-amber-950/30">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <BellRing className="h-4 w-4 text-amber-600" />
        <span className="text-sm font-medium text-amber-900 dark:text-amber-200">
          Dépenses récurrentes non saisies ce mois-ci :
        </span>
        <div className="flex flex-wrap gap-2">
          {missing.map((m) => (
            <Button
              key={m.id}
              asChild
              size="sm"
              variant="outline"
              className="h-7 border-amber-300 bg-background"
            >
              <Link href={`/dashboard/depenses/nouvelle?recurrent=${m.id}`}>
                {m.label}
              </Link>
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
