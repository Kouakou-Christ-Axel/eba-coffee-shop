import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import LoginButton from './login-button';

export default async function LoginPage() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (session) {
    redirect('/dashboard');
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="text-center">
        <h1 className="mb-2 text-2xl font-bold text-gray-900">
          EBA Coffee Shop
        </h1>
        <p className="mb-8 text-sm text-gray-500">
          Accès réservé aux administrateurs
        </p>
        <LoginButton />
      </div>
    </main>
  );
}
