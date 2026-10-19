// lib/jeko/transfer-errors.ts
//
// Raisons d'échec d'un transfert Jèko (page « Gérer les échecs » de la doc) :
// message pour le staff, ce qu'il peut y faire, et si l'on peut réessayer tel quel.

export type TransferFailureAdvice = {
  message: string;
  action: string;
  /** Le numéro ou le canal sont à corriger (puis nouvelle validation admin). */
  editable: boolean;
  /** Réessayer sans rien changer peut réussir. */
  retryable: boolean;
  /** Problème de configuration Jèko : rien à corriger dans l'application. */
  config: boolean;
};

const ADVICE: Record<string, TransferFailureAdvice> = {
  insufficient_balance: {
    message: 'Solde Jèko insuffisant',
    action: 'Recharger le solde Jèko, puis réessayer.',
    editable: false,
    retryable: true,
    config: false,
  },
  transfer_failed: {
    message: 'L’opérateur a refusé le transfert',
    action:
      'Vérifier le numéro et le moyen de paiement, les corriger si besoin, puis faire revalider.',
    editable: true,
    retryable: true,
    config: false,
  },
  contact_not_found: {
    message: 'Bénéficiaire introuvable chez Jèko',
    action: 'Réessayer : le bénéficiaire sera recréé.',
    editable: true,
    retryable: true,
    config: false,
  },
  validation_error: {
    message: 'Jèko refuse les données (numéro, montant ou moyen invalide)',
    action:
      'Vérifier le numéro, le moyen de paiement et le montant minimum (100 F pour Moov, 5 F sinon).',
    editable: true,
    retryable: false,
    config: false,
  },
  unauthorized: {
    message: 'Clés API Jèko refusées',
    action: 'Vérifier les clés JEKO_API_KEY et JEKO_API_KEY_ID.',
    editable: false,
    retryable: false,
    config: true,
  },
  forbidden: {
    message: 'La clé API Jèko n’a pas le droit d’envoyer des transferts',
    action: 'Activer Pay-out pour cette clé chez Jèko.',
    editable: false,
    retryable: false,
    config: true,
  },
  forbidden_action: {
    message: 'La clé API Jèko n’a pas le droit d’envoyer des transferts',
    action: 'Activer Pay-out pour cette clé chez Jèko.',
    editable: false,
    retryable: false,
    config: true,
  },
  partner_api_ip_not_whitelisted: {
    message: 'Adresse IP du serveur non autorisée chez Jèko',
    action: 'Ajouter l’adresse IP du serveur à la liste autorisée Jèko.',
    editable: false,
    retryable: false,
    config: true,
  },
  business_not_enabled_for_api_access: {
    message: 'Accès API non activé pour ce compte Jèko',
    action: 'Demander l’activation de l’API à Jèko.',
    editable: false,
    retryable: false,
    config: true,
  },
  store_not_found: {
    message: 'Magasin Jèko introuvable',
    action: 'Vérifier JEKO_STORE_ID.',
    editable: false,
    retryable: false,
    config: true,
  },
  jeko_not_configured: {
    message: 'Jèko n’est pas configuré',
    action: 'Renseigner les variables JEKO_* puis réessayer.',
    editable: false,
    retryable: true,
    config: true,
  },
  invalid_destination: {
    message: 'Numéro ou canal invalide pour un transfert',
    action: 'Corriger le numéro ou le canal, puis faire revalider.',
    editable: true,
    retryable: false,
    config: false,
  },
  not_sent: {
    message: 'Vérifié : le transfert n’est pas parti',
    action: 'Réessayer.',
    editable: true,
    retryable: true,
    config: false,
  },
  auto_failed: {
    message: 'Le remboursement automatique a échoué',
    action: 'Vérifier le numéro, le corriger si besoin, puis faire revalider.',
    editable: true,
    retryable: true,
    config: false,
  },
};

const UNKNOWN: TransferFailureAdvice = {
  message: 'Échec du transfert',
  action: 'Vérifier le détail dans le Dashboard Jèko, puis réessayer.',
  editable: true,
  retryable: true,
  config: false,
};

export function describeTransferFailure(
  code: string | null | undefined
): TransferFailureAdvice {
  return (code && ADVICE[code]) || UNKNOWN;
}
