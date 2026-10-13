import type { PaymentRequest } from './types';

export const fcfa = (cents: number) =>
  String(cents / 100).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export function paymentPage(r: PaymentRequest): string {
  const action = (name: string, label: string, hint: string) => `
    <form method="post" action="/pay/${r.id}/${name}">
      <button type="submit">${label}</button><small>${hint}</small>
    </form>`;
  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Jèko (factice) — paiement</title>
<style>
  body{font-family:system-ui,sans-serif;max-width:28rem;margin:2rem auto;padding:0 1rem;color:#222}
  .banner{background:#fff3cd;border:1px solid #e0c36a;padding:.6rem .8rem;border-radius:.5rem;font-size:.85rem}
  .amount{font-size:2rem;font-weight:700;margin:.5rem 0}
  form{margin:.9rem 0;display:flex;flex-direction:column;gap:.2rem}
  button{padding:.75rem;font-size:1rem;border-radius:.5rem;border:1px solid #888;cursor:pointer}
  small{color:#666}
</style></head><body>
<p class="banner">⚠️ Serveur Jèko <b>factice</b> (local). Aucun argent réel n'est en jeu.</p>
<h1>Paiement</h1>
<p>Référence : <code>${escapeHtml(r.reference)}</code></p>
<p class="amount">${fcfa(r.amountCents)} FCFA</p>
<p>Moyen : <b>${escapeHtml(r.paymentMethod)}</b> — statut : <b>${r.status}</b></p>
${action('pay', '✅ Payer', 'Succès : webhook signé envoyé, retour sur le site.')}
${action('pay-silent', '✅ Payer sans webhook', 'Succès lisible par l’API mais AUCUN webhook : teste la réconciliation au retour.')}
${action('fail', '❌ Échouer', 'Statut error (solde insuffisant), retour sur la page d’erreur.')}
${action('abandon', '🚪 Quitter sans payer', 'Rien ne change : la commande attendra jusqu’à son expiration.')}
</body></html>`;
}
