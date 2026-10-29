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
import { OrderMutationError } from '@/lib/orders/mutations/errors';

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

/**
 * Enveloppe une mutation qui touche au stock : la carte publique est invalidée
 * APRÈS elle (donc après le commit de sa transaction), au point d'entrée
 * partagé par les routes caisse, les server actions, les outils MCP et le flux
 * Jèko — plus aucun appelant n'a à y penser.
 *
 * - Succès : invalide si `when(args, résultat)` le permet (défaut : toujours).
 * - Échec : une erreur métier (`OrderMutationError`, dont la 409 de pénurie)
 *   n'a rien écrit ; toute autre erreur peut laisser une écriture partielle
 *   (ex. stock crédité par `coverShortage`), on invalide alors par prudence.
 */
export function revalidatesPublicMenu<A extends unknown[], R>(
  fn: (...args: A) => Promise<R>,
  when?: (args: A, result: R) => boolean
): (...args: A) => Promise<R> {
  return async (...args: A): Promise<R> => {
    let result: R;
    try {
      result = await fn(...args);
    } catch (err) {
      if (!(err instanceof OrderMutationError)) revalidatePublicMenu();
      throw err;
    }
    if (!when || when(args, result)) revalidatePublicMenu();
    return result;
  };
}
