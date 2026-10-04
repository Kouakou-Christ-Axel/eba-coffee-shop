// scripts/jeko-mock/run.ts
//
// Lance le serveur Jèko factice (voir server.ts) : `pnpm jeko:mock`.
// Lit les mêmes variables que l'application (.env), pour que les clés et le secret
// du webhook concordent sans rien recopier.

import { createJekoMock } from './server';

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(
      `[jeko-mock] ${name} manquante dans .env — voir la section « Paiement en ligne » de .env.example`
    );
    process.exit(1);
  }
  return value;
}

const port = Number(process.env.JEKO_MOCK_PORT ?? 4010);
const webhookUrl =
  process.env.JEKO_MOCK_WEBHOOK_URL ??
  'http://localhost:3000/api/webhooks/jeko';

const mock = await createJekoMock({
  apiKey: required('JEKO_API_KEY'),
  apiKeyId: required('JEKO_API_KEY_ID'),
  webhookSecret: required('JEKO_WEBHOOK_SECRET'),
  webhookUrl,
  port,
});

console.log(`
Serveur Jèko FACTICE prêt : ${mock.baseUrl}
  • L'application doit viser ce serveur :  JEKO_API_BASE_URL=${mock.baseUrl}
  • Les webhooks signés partent vers :     ${webhookUrl}
  • Aucun argent réel n'est en jeu (Ctrl+C pour arrêter).
`);

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => void mock.close().then(() => process.exit(0)));
}
