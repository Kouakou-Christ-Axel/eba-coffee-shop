// emails/invite-staff.tsx
import * as React from 'react';
import {
  Html,
  Body,
  Container,
  Heading,
  Text,
  Link,
  Hr,
} from '@react-email/components';

type Props = {
  inviterName: string;
  roleLabel: string;
  loginUrl: string;
};

export default function InviteStaffEmail({
  inviterName,
  roleLabel,
  loginUrl,
}: Props) {
  return (
    <Html lang="fr">
      <Body style={{ fontFamily: 'sans-serif', color: '#333' }}>
        <Container
          style={{ maxWidth: '600px', margin: '0 auto', padding: '24px' }}
        >
          <Heading as="h1">Bienvenue chez EBA Coffee Shop</Heading>

          <Text>
            {inviterName} t’a invité·e à rejoindre l’équipe EBA Coffee Shop en
            tant que <strong>{roleLabel}</strong>.
          </Text>

          <Text>
            Connecte-toi pour accéder à ton espace. Tu recevras un code à 6
            chiffres par email à chaque connexion.
          </Text>

          <Text style={{ textAlign: 'center', padding: '16px 0' }}>
            <Link
              href={loginUrl}
              style={{
                backgroundColor: '#6c3077',
                color: '#fff',
                padding: '12px 24px',
                borderRadius: '8px',
                textDecoration: 'none',
                fontWeight: 'bold',
              }}
            >
              Se connecter
            </Link>
          </Text>

          <Hr />

          <Text style={{ color: '#999', fontSize: '0.8em' }}>
            EBA Coffee Shop — Abidjan, Côte d&apos;Ivoire
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
