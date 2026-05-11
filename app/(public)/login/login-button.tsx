'use client';
import { useState } from 'react';
import { authClient } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';

export default function LoginButton() {
  const [loading, setLoading] = useState(false);

  const handleSignIn = async () => {
    setLoading(true);
    await authClient.signIn.social({
      provider: 'google',
      callbackURL: '/dashboard',
    });
  };

  return (
    <Button onClick={handleSignIn} disabled={loading} className="w-full">
      {loading ? 'Connexion...' : 'Se connecter avec Google'}
    </Button>
  );
}
