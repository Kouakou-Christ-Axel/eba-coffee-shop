// lib/ai/openrouter.ts
//
// Client minimal de l'API OpenRouter (compatible OpenAI « chat/completions »)
// avec appels d'outils. La config est passée en paramètre et le `fetch` est
// injectable : ce module reste pur et testable hors runtime Next. La lecture de
// l'env se fait dans `lib/ai/config.ts`.

const BASE_URL = 'https://openrouter.ai/api/v1';
const REQUEST_TIMEOUT_MS = 45_000;

export type OpenRouterConfig = {
  apiKey: string;
  model: string;
  baseUrl?: string;
};

export type ToolCall = {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
};

export type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } }
  | { type: 'file'; file: { filename: string; file_data: string } };

export type ChatMessage =
  | { role: 'system'; content: string }
  | { role: 'user'; content: string | ContentPart[] }
  | { role: 'assistant'; content: string | null; tool_calls?: ToolCall[] }
  | { role: 'tool'; tool_call_id: string; content: string };

export type ToolDefinition = {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

export type AssistantMessage = Extract<ChatMessage, { role: 'assistant' }>;

export class OpenRouterError extends Error {
  constructor(
    message: string,
    readonly status?: number
  ) {
    super(message);
    this.name = 'OpenRouterError';
  }
}

type CompletionResponse = {
  choices?: { message?: AssistantMessage }[];
  error?: { message?: string };
};

export async function chatCompletion(
  config: OpenRouterConfig,
  input: { messages: ChatMessage[]; tools?: ToolDefinition[] },
  fetchImpl: typeof fetch = fetch
): Promise<AssistantMessage> {
  const base = (config.baseUrl ?? BASE_URL).replace(/\/+$/, '');
  let res: Response;
  try {
    res = await fetchImpl(`${base}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
        'X-Title': 'EBA Coffee Shop',
      },
      body: JSON.stringify({
        model: config.model,
        messages: input.messages,
        ...(input.tools?.length
          ? { tools: input.tools, tool_choice: 'auto' }
          : {}),
        temperature: 0.2,
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (err) {
    throw new OpenRouterError(
      err instanceof Error ? err.message : 'Appel OpenRouter impossible'
    );
  }

  const json = (await res
    .json()
    .catch(() => null)) as CompletionResponse | null;
  if (!res.ok || !json?.choices?.[0]?.message) {
    throw new OpenRouterError(
      json?.error?.message ?? `OpenRouter a répondu ${res.status}`,
      res.status
    );
  }
  return json.choices[0].message;
}
