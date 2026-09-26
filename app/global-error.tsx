'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import './globals.css';

// Ne couvre que les erreurs du root layout lui-même (Providers, polices,
// generateMetadata) : `error.tsx` dans (public)/(dashboard) intercepte tout
// le reste avant que ce filet ne soit nécessaire. Next exige ici son propre
// <html>/<body>, donc pas de Providers HeroUI dont l'échec a pu causer l'erreur.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[app/global-error]', error);
  }, [error]);

  return (
    <html lang="fr">
      <body className="flex min-h-screen items-center justify-center bg-[#f5efe6] px-4 py-12 font-sans text-[#2c1a10]">
        <div className="w-full max-w-lg rounded-2xl border border-black/10 bg-white/90 p-8 text-center shadow-xl">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#6b3fa0]">
            Erreur 500
          </p>
          <h1 className="mt-2 text-2xl font-bold sm:text-3xl">
            Une erreur inattendue est survenue
          </h1>
          <p className="mt-3 text-sm text-black/60">
            Le site rencontre un problème technique. Veuillez réessayer dans un
            instant.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={reset}
              className="rounded-full bg-[#6b3fa0] px-6 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
            >
              Réessayer
            </button>
            <Link
              href="/"
              className="rounded-full border border-[#6b3fa0]/30 px-6 py-2.5 text-sm font-semibold text-[#6b3fa0] transition hover:bg-[#6b3fa0]/10"
            >
              Retour à l&apos;accueil
            </Link>
          </div>
        </div>
      </body>
    </html>
  );
}
