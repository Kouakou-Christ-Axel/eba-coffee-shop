// emails/otp-code.tsx
import * as React from 'react';
import {
  Html,
  Body,
  Container,
  Heading,
  Text,
  Hr,
} from '@react-email/components';

type Props = { code: string };

export default function OtpCodeEmail({ code }: Props) {
  return (
    <Html lang="fr">
      <Body style={{ fontFamily: 'sans-serif', color: '#333' }}>
        <Container
          style={{ maxWidth: '600px', margin: '0 auto', padding: '24px' }}
        >
          <Heading as="h1">Votre code de connexion EBA</Heading>

          <Text>
            Utilisez le code ci-dessous pour vous connecter au dashboard EBA
            Coffee Shop.
          </Text>

          <Text
            style={{
              fontSize: '32px',
              fontWeight: 'bold',
              letterSpacing: '8px',
              textAlign: 'center',
              padding: '16px',
              backgroundColor: '#f4f4f4',
              borderRadius: '8px',
              fontFamily: 'monospace',
            }}
          >
            {code}
          </Text>

          <Text style={{ color: '#666', fontSize: '0.9em' }}>
            Ce code est valable pendant 5 minutes. Si vous n&apos;êtes pas à
            l&apos;origine de cette demande, ignorez cet email.
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
