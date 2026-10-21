// lib/revalidate-public-menu.ts
//
// Invalide les surfaces publiques qui affichent le stock : la carte (ISR),
// l'API menu et l'accueil (sa vitrine est commandable et filtre sur le stock).
// À appeler après TOUTE écriture qui décrémente ou restitue du stock, y compris
// la réservation à la création d'une commande publique payée en ligne.
//
// Best-effort, jamais bloquant : l'écriture en base a déjà eu lieu, et hors
// contexte de requête Next (tests, scripts) `revalidatePath` peut échouer.

//
// Appelée pendant un RENDU (ex. `expirePendingOrders` lancé depuis une page),
// `revalidatePath` est refusé par Next : on reporte alors l'invalidation à
// `after()`, qui s'exécute une fois la réponse envoyée, hors rendu.

import { revalidatePath } from 'next/cache';
import { after } from 'next/server';

function invalidate(): void {
  revalidatePath('/api/menu');
  revalidatePath('/carte');
  revalidatePath('/');
}

export function revalidatePublicMenu(): void {
  try {
    invalidate();
    return;
  } catch {
    // Pendant un rendu : on retente hors rendu ci-dessous.
  }
  try {
    after(() => {
      try {
        invalidate();
      } catch (err) {
        console.warn('[revalidatePublicMenu] a échoué', err);
      }
    });
  } catch (err) {
    console.warn('[revalidatePublicMenu] a échoué', err);
  }
}
