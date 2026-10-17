import { describe, expect, it, vi } from 'vitest';
import { chatCompletion, OpenRouterError, withPromptCache } from './openrouter';

const config = { apiKey: 'k', model: 'm/x' };
const ok = (message: unknown) =>
  vi.fn(async () => Response.json({ choices: [{ message }] }));

describe('chatCompletion', () => {
  it('envoie la clé, le modèle et les outils', async () => {
    const fetchImpl = ok({ role: 'assistant', content: 'salut' });
    const tools = [
      {
        type: 'function' as const,
        function: { name: 't', description: '', parameters: {} },
      },
    ];
    const msg = await chatCompletion(
      config,
      { messages: [{ role: 'user', content: 'hi' }], tools },
      fetchImpl as unknown as typeof fetch
    );
    expect(msg.content).toBe('salut');
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe('https://openrouter.ai/api/v1/chat/completions');
    expect((init.headers as Record<string, string>).Authorization).toBe(
      'Bearer k'
    );
    const body = JSON.parse(init.body as string);
    expect(body.model).toBe('m/x');
    expect(body.tool_choice).toBe('auto');
  });

  it('lève OpenRouterError sur une réponse en erreur', async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json({ error: { message: 'quota' } }, { status: 402 })
    );
    await expect(
      chatCompletion(
        config,
        { messages: [] },
        fetchImpl as unknown as typeof fetch
      )
    ).rejects.toMatchObject({
      name: 'OpenRouterError',
      status: 402,
      message: 'quota',
    });
    expect(OpenRouterError).toBeDefined();
  });
});

describe('withPromptCache', () => {
  const messages = [
    { role: 'system' as const, content: 'consigne' },
    { role: 'user' as const, content: 'hi' },
  ];

  it.each(['anthropic/claude-haiku-5.5', 'google/gemini-3.1-flash-lite'])(
    'pose un point de cache sur le message système (%s)',
    (model) => {
      const [system, user] = withPromptCache(model, messages);
      expect(system.content).toEqual([
        {
          type: 'text',
          text: 'consigne',
          cache_control: { type: 'ephemeral' },
        },
      ]);
      expect(user).toBe(messages[1]);
    }
  );

  it('laisse intacts les modèles à cache automatique', () => {
    expect(withPromptCache('deepseek/deepseek-v4.1-flash', messages)).toBe(
      messages
    );
  });
});
