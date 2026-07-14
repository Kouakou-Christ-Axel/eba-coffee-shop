'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Couvre toutes les routes dashboard (y compris les throws « Non autorisé »
// des guards de page — cf. lib/auth-helpers.ts).
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[app/(dashboard)/dashboard/error]', error);
  }, [error]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 rounded-xl border bg-card py-16 text-center">
      <div className="rounded-full bg-destructive/10 p-6">
        <AlertTriangle className="h-12 w-12 text-destructive" />
      </div>
      <h1 className="text-2xl font-bold">Une erreur est survenue</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        {error.message === 'Non autorisé'
          ? "Vous n'avez pas les droits nécessaires pour accéder à cette page."
          : "Un problème imprévu nous a empêché d'afficher cette page. Réessayez, ou revenez au tableau de bord."}
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button onClick={reset}>Réessayer</Button>
        <Button asChild variant="outline">
          <Link href="/dashboard">Retour au tableau de bord</Link>
        </Button>
      </div>
    </div>
  );
}
