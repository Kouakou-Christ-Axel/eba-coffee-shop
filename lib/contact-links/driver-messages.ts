export function buildDriverRequestMessage(params: {
  customerName: string | null;
  dailyNumber: number;
  /** Repère à indiquer comme destination dans l'appli Yango. */
  yangoLandmark: string;
  /** Numéro du commerce à joindre par le livreur. */
  phone: string;
}): string {
  const { customerName, dailyNumber, yangoLandmark, phone } = params;
  const greeting = customerName ? `Bonjour ${customerName}` : 'Bonjour';
  const number = String(dailyNumber).padStart(3, '0');
  return [
    `${greeting}, ta commande EBA #${number} est bientôt prête.`,
    '',
    'Tu peux envoyer ton livreur.',
    `Localisation : ${yangoLandmark}`,
    `Le numéro : ${phone}`,
    'Et envoie la capture pour le livreur.',
  ].join('\n');
}

/** Variante groupée : UN message pour un client dont plusieurs commandes partent avec le même livreur. */
export function buildGroupDriverRequestMessage(params: {
  customerName: string | null;
  dailyNumbers: number[];
  yangoLandmark: string;
  phone: string;
}): string {
  const { customerName, dailyNumbers, yangoLandmark, phone } = params;
  const greeting = customerName ? `Bonjour ${customerName}` : 'Bonjour';
  const refs = dailyNumbers
    .map((n) => `#${String(n).padStart(3, '0')}`)
    .join(', ');
  return [
    `${greeting}, tes ${dailyNumbers.length} commandes EBA (${refs}) sont bientôt prêtes.`,
    '',
    'Un seul livreur peut tout récupérer.',
    `Localisation : ${yangoLandmark}`,
    `Le numéro : ${phone}`,
    'Et envoie la capture pour le livreur.',
  ].join('\n');
}

export function buildDriverShareMessage(params: {
  pickupCode: string;
  customerName: string | null;
  pickupAddress: string | null;
  pickupMapsUrl: string | null;
  trackingUrl: string;
}): string {
  const {
    pickupCode,
    customerName,
    pickupAddress,
    pickupMapsUrl,
    trackingUrl,
  } = params;
  const who = customerName ? `la commande de ${customerName}` : 'ma commande';

  const lines = [
    `Tu récupères ${who} chez EBA Coffee Shop.`,
    `Code de retrait : ${pickupCode}`,
  ];
  if (pickupAddress) lines.push(`Adresse : ${pickupAddress}`);
  if (pickupMapsUrl) lines.push(`Localisation : ${pickupMapsUrl}`);
  lines.push(`Statut (pars quand « Prête ») : ${trackingUrl}`);
  return lines.join('\n');
}
