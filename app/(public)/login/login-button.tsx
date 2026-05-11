'use client';
import { useState } from 'react';
import { authClient } from '@/lib/auth-client';

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
    <button
      onClick={handleSignIn}
      disabled={loading}
      className="flex items-center justify-center gap-3 rounded-lg border border-gray-200 bg-white px-6 py-3 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:opacity-50"
    >
      {loading ? 'Connexion...' : 'Se connecter avec Google'}
    </button>
  );
}
