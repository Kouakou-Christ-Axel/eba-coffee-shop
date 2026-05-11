import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import LoginButton from './login-button';

export default async function LoginPage() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (session) {
    redirect('/dashboard');
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle>EBA Coffee Shop</CardTitle>
          <CardDescription>Accès réservé aux administrateurs</CardDescription>
        </CardHeader>
        <CardContent>
          <LoginButton />
        </CardContent>
      </Card>
    </div>
  );
}
