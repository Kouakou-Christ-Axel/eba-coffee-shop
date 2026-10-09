// lib/revalidate-public-menu.ts
//
// Invalide les surfaces publiques qui affichent le stock : la carte (ISR),
// l'API menu et l'accueil (sa vitrine est commandable et filtre sur le stock).
// À appeler après TOUTE écriture qui décrémente ou restitue du stock, y compris
// la réservation à la création d'une commande publique payée en ligne.
//
// Best-effort, jamais bloquant : l'écriture en base a déjà eu lieu, et hors
// contexte de requête Next (tests, scripts) `revalidatePath` peut échouer.

import { revalidatePath } from 'next/cache';

export function revalidatePublicMenu(): void {
  try {
    revalidatePath('/api/menu');
    revalidatePath('/carte');
    revalidatePath('/');
  } catch (err) {
    console.warn('[revalidatePublicMenu] a échoué', err);
  }
}
