// lib/ai/assistant/mask-pii.ts
//
// L'assistant envoie les résultats d'outils à OpenRouter puis au fournisseur du
// modèle, hors Côte d'Ivoire. Les numéros de téléphone des clients (et du
// livreur) n'ont pas à y partir en clair : on garde de quoi reconnaître une
// personne dans la conversation (deux derniers chiffres) sans l'exposer. Les
// identifiants (`id`) restent intacts, ce qui suffit aux outils de suite.

const PHONE_KEY = /phone|whatsapp|tel$/i;

export function maskPhone(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (digits.length < 4) return '****';
  return `****${digits.slice(-2)}`;
}

/** Copie profonde de `value` où toute clé « téléphone » est masquée. */
export function maskPhonesDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(maskPhonesDeep);
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) =>
        PHONE_KEY.test(k) && typeof v === 'string'
          ? [k, maskPhone(v)]
          : [k, maskPhonesDeep(v)]
      )
    );
  }
  return value;
}
