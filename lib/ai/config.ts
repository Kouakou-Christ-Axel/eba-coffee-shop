// lib/ai/config.ts
//
// Lecture de la config OpenRouter depuis varlock. Fonction et non constante de
// module : `ENV` n'est peuplée que dans le runtime Next.js (cf. lib/site-url.ts).
// `null` = assistant inerte (clé absente).

import { ENV } from 'varlock/env';
import type { OpenRouterConfig } from './openrouter';

export const DEFAULT_ASSISTANT_MODEL = 'google/gemini-3.1-flash-lite';

export function openRouterConfig(): OpenRouterConfig | null {
  if (!ENV.OPENROUTER_API_KEY) return null;
  return {
    apiKey: ENV.OPENROUTER_API_KEY,
    model: ENV.OPENROUTER_MODEL || DEFAULT_ASSISTANT_MODEL,
  };
}
