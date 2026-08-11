// lib/api-error.ts
//
// Extraction du message d'erreur d'une réponse d'API interne.
//
// Nos routes renvoient `{ error }` sous DEUX formes :
//   - une chaîne, pour les erreurs métier (« Stock insuffisant pour … ») ;
//   - l'objet `ZodError.flatten()`, pour les échecs de validation
//     (ex. `app/api/caisse/orders/route.ts`).
//
// Les appelants qui ne testaient que `typeof error === 'string'` affichaient
// donc « Erreur 400 » au caissier sur toute erreur de validation, sans jamais
// dire quel champ posait problème.

/** Forme de `ZodError.flatten()` : erreurs globales + erreurs par champ. */
type FlattenedError = {
  formErrors?: string[];
  fieldErrors?: Record<string, string[] | undefined>;
};

function firstMessage(error: FlattenedError): string | null {
  const form = error.formErrors?.find((m) => typeof m === 'string' && m.trim());
  if (form) return form;
  for (const [field, messages] of Object.entries(error.fieldErrors ?? {})) {
    const message = messages?.find((m) => typeof m === 'string' && m.trim());
    if (message) return `${field} : ${message}`;
  }
  return null;
}

/**
 * Message affichable pour une réponse en échec. Ne lève jamais : un corps
 * illisible retombe sur « Erreur <statut> ».
 */
export async function readApiError(res: Response): Promise<string> {
  const fallback = `Erreur ${res.status}`;
  try {
    const data = (await res.json()) as { error?: unknown };
    return extractApiError(data.error) ?? fallback;
  } catch {
    return fallback;
  }
}

/** Variante synchrone, quand le corps est déjà désérialisé. */
export function extractApiError(error: unknown): string | null {
  if (typeof error === 'string' && error.trim()) return error;
  if (error && typeof error === 'object') {
    return firstMessage(error as FlattenedError);
  }
  return null;
}
