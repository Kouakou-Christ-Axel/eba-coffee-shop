import { beforeEach, describe, expect, it, vi } from 'vitest';

const runTool = vi.fn();
vi.mock('./tools', () => ({
  assistantToolDefinitions: () => [],
  isWriteTool: (n: string) => n.startsWith('create_'),
  runAssistantTool: (...a: unknown[]) => runTool(...a),
  toolTitle: (n: string) => `Titre ${n}`,
}));
vi.mock('./prompt', () => ({ systemPrompt: () => 'sys' }));

import { runAssistant } from './run';

const config = { apiKey: 'k', model: 'm' };
const actor = { name: 'A', role: 'ADMIN' as const };
const call = (id: string, name: string, args = '{}') => ({
  id,
  type: 'function' as const,
  function: { name, arguments: args },
});

function fetchReturning(...messages: unknown[]) {
  const queue = [...messages];
  return vi.fn(async () =>
    Response.json({ choices: [{ message: queue.shift() }] })
  ) as unknown as typeof fetch;
}

beforeEach(() => runTool.mockReset());

describe('runAssistant', () => {
  it('exécute les lectures puis répond', async () => {
    runTool.mockResolvedValue({ ok: true, content: '42' });
    const res = await runAssistant(
      config,
      actor,
      [{ role: 'user', content: 'CA ?' }],
      {},
      fetchReturning(
        {
          role: 'assistant',
          content: null,
          tool_calls: [call('1', 'get_daily_stats')],
        },
        { role: 'assistant', content: 'Le CA est 42.' }
      )
    );
    expect(res.pending).toEqual([]);
    expect(res.messages.at(-1)).toMatchObject({ content: 'Le CA est 42.' });
    expect(runTool).toHaveBeenCalledTimes(1);
  });

  it("met une écriture en attente sans l'exécuter", async () => {
    const res = await runAssistant(
      config,
      actor,
      [{ role: 'user', content: 'dépense' }],
      {},
      fetchReturning({
        role: 'assistant',
        content: null,
        tool_calls: [call('9', 'create_expense', '{"amount":5000}')],
      })
    );
    expect(runTool).not.toHaveBeenCalled();
    expect(res.pending).toEqual([
      {
        id: '9',
        name: 'create_expense',
        title: 'Titre create_expense',
        args: { amount: 5000 },
      },
    ]);
  });

  it("exécute l'écriture une fois approuvée", async () => {
    runTool.mockResolvedValue({ ok: true, content: 'créée' });
    const history = [
      { role: 'user' as const, content: 'dépense' },
      {
        role: 'assistant' as const,
        content: null,
        tool_calls: [call('9', 'create_expense')],
      },
    ];
    const res = await runAssistant(
      config,
      actor,
      history,
      { '9': 'approve' },
      fetchReturning({ role: 'assistant', content: 'Fait.' })
    );
    expect(runTool).toHaveBeenCalledTimes(1);
    expect(res.pending).toEqual([]);
  });

  it("n'exécute pas une écriture refusée", async () => {
    const history = [
      { role: 'user' as const, content: 'dépense' },
      {
        role: 'assistant' as const,
        content: null,
        tool_calls: [call('9', 'create_expense')],
      },
    ];
    const res = await runAssistant(
      config,
      actor,
      history,
      { '9': 'reject' },
      fetchReturning({ role: 'assistant', content: 'Annulé.' })
    );
    expect(runTool).not.toHaveBeenCalled();
    expect(
      res.messages.some(
        (m) => m.role === 'tool' && m.content.includes('Refusé')
      )
    ).toBe(true);
  });

  it("s'arrête après le plafond d'étapes", async () => {
    runTool.mockResolvedValue({ ok: true, content: 'x' });
    const loop = {
      role: 'assistant',
      content: null,
      tool_calls: [call('1', 'list_x')],
    };
    const res = await runAssistant(
      config,
      actor,
      [{ role: 'user', content: 'boucle' }],
      {},
      fetchReturning(loop, loop, loop, loop, loop, loop, loop)
    );
    expect(res.messages.at(-1)).toMatchObject({ role: 'assistant' });
    expect(res.pending).toEqual([]);
  });
});
