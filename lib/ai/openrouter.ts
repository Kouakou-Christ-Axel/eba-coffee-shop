// lib/ai/openrouter.ts
//
// Client générique OpenRouter (https://openrouter.ai) pour les appels vision
// structurés. Pas de SDK ajouté — un simple wrapper fetch, cohérent avec le
// reste du repo (aucune dépendance IA existante). Seul consommateur actuel :
// lib/ai/payment-proof.ts (pré-analyse des captures Wave/Orange Money), mais
// générique pour un futur usage.

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

export class OpenRouterConfigError extends Error {
  constructor() {
    super('OPENROUTER_API_KEY absente — appel OpenRouter ignoré');
    this.name = 'OpenRouterConfigError';
  }
}

export class OpenRouterCallError extends Error {
  constructor(
    message: string,
    readonly cause?: unknown
  ) {
    super(message);
    this.name = 'OpenRouterCallError';
  }
}

export type OpenRouterVisionParams = {
  model: string;
  imageUrl: string;
  systemPrompt: string;
  userPrompt: string;
  /** JSON Schema (draft standard) — force une sortie structurée plutôt qu'un
   * texte libre à parser, cf. https://openrouter.ai/docs/features/structured-outputs */
  jsonSchema: {
    name: string;
    schema: Record<string, unknown>;
  };
};

/**
 * Appelle un modèle vision OpenRouter avec une image + un schéma JSON de
 * sortie attendu, et retourne l'objet déjà parsé.
 *
 * Lève `OpenRouterConfigError` si `OPENROUTER_API_KEY` est absente — à
 * l'appelant de traiter ce cas en no-op (la fonctionnalité reste inerte tant
 * que la clé n'est pas configurée). Lève `OpenRouterCallError` pour tout
 * échec réseau/HTTP/parsing.
 */
export async function callOpenRouterVision(
  params: OpenRouterVisionParams
): Promise<unknown> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new OpenRouterConfigError();
  }

  let res: Response;
  try {
    res = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        // Attribution recommandée par OpenRouter (facultative côté API, mais
        // évite d'apparaître comme un client anonyme dans leur dashboard).
        'HTTP-Referer': 'https://ebacoffeeshop.com',
        'X-Title': 'EBA Coffee Shop',
      },
      body: JSON.stringify({
        model: params.model,
        messages: [
          { role: 'system', content: params.systemPrompt },
          {
            role: 'user',
            content: [
              { type: 'text', text: params.userPrompt },
              { type: 'image_url', image_url: { url: params.imageUrl } },
            ],
          },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: params.jsonSchema.name,
            strict: true,
            schema: params.jsonSchema.schema,
          },
        },
      }),
    });
  } catch (err) {
    throw new OpenRouterCallError('Appel réseau OpenRouter échoué', err);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new OpenRouterCallError(
      `OpenRouter a répondu ${res.status} : ${body.slice(0, 500)}`
    );
  }

  let payload: unknown;
  try {
    payload = await res.json();
  } catch (err) {
    throw new OpenRouterCallError('Réponse OpenRouter non-JSON', err);
  }

  const content = (
    payload as {
      choices?: Array<{ message?: { content?: string } }>;
    }
  )?.choices?.[0]?.message?.content;

  if (typeof content !== 'string') {
    throw new OpenRouterCallError(
      'Réponse OpenRouter sans contenu de message exploitable'
    );
  }

  try {
    return JSON.parse(content);
  } catch (err) {
    throw new OpenRouterCallError(
      'Contenu du message OpenRouter non-JSON malgré response_format',
      err
    );
  }
}
