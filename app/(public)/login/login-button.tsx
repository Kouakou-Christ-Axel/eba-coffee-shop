'use client';
import { authClient } from '@/lib/auth-client';

export default function LoginButton() {
  return (
    <button
      onClick={() =>
        authClient.signIn.social({
          provider: 'google',
          callbackURL: '/dashboard',
        })
      }
      className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-6 py-3 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50"
    >
      Se connecter avec Google
    </button>
  );
}
