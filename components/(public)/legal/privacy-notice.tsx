// components/(public)/legal/privacy-notice.tsx
//
// Mention d'information à la collecte (loi ivoirienne 2013-450 : finalité,
// durée, droits, avant que la personne ne valide). Une ligne sous le bouton de
// validation de chaque formulaire public qui recueille nom / téléphone / e-mail.

import Link from 'next/link';
import { RETENTION } from '@/config/data-protection';

const NOTICES = {
  order: `Vos nom et téléphone servent à préparer votre commande, à vous prévenir et à gérer la carte de fidélité. Ils sont conservés ${RETENTION.orderYears} ans puis anonymisés.`,
  poll: `Votre téléphone et votre navigateur servent à éviter les votes en double. Ils sont effacés au bout de ${RETENTION.pollVoteMetaDays} jours.`,
  suggestion: `Votre nom et votre téléphone servent à vous recontacter au sujet de votre suggestion. Ils sont conservés ${RETENTION.pollSuggestionMonths} mois après sa modération.`,
  contact:
    'Vos coordonnées servent uniquement à répondre à votre message (12 mois au plus).',
  login: 'Votre e-mail sert uniquement à vous envoyer un code de connexion.',
} as const;

export function PrivacyNotice({
  kind,
  className = '',
}: {
  kind: keyof typeof NOTICES;
  className?: string;
}) {
  return (
    <p className={`text-xs leading-relaxed text-foreground/60 ${className}`}>
      {NOTICES[kind]} Vous pouvez accéder à vos données, les corriger ou les
      faire supprimer :{' '}
      <Link
        href="/confidentialite"
        className="underline underline-offset-2 hover:text-primary"
      >
        politique de confidentialité
      </Link>
      .
    </p>
  );
}
