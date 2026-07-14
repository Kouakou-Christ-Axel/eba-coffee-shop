import type { Metadata } from 'next';
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

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

type SearchParams = Record<string, string | string[] | undefined>;

// Destination après connexion. Quand le serveur MCP redirige ici au milieu d'un
// flux OAuth (Claude web/mobile), il passe ses paramètres d'autorisation en
// query. On les renvoie alors vers `/api/auth/mcp/authorize` pour FINIR le flux
// (le code OAuth est émis, puis le client est redirigé vers son callback).
// Sinon, destination par défaut : le dashboard. Le chemin est fixe (pas de
// redirection ouverte) — seuls les paramètres sont repris tels quels.
function buildContinueUrl(searchParams: SearchParams): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (typeof value === 'string') params.set(key, value);
    else if (Array.isArray(value) && value[0] != null)
      params.set(key, value[0]);
  }
  if (params.get('client_id') && params.get('response_type')) {
    return `/api/auth/mcp/authorize?${params.toString()}`;
  }
  return '/dashboard';
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
} = {}) {
  const continueUrl = buildContinueUrl((await searchParams) ?? {});
  const session = await auth.api.getSession({ headers: await headers() });

  if (session) {
    redirect(continueUrl);
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle>EBA Coffee Shop</CardTitle>
          <CardDescription>Accès réservé aux administrateurs</CardDescription>
        </CardHeader>
        <CardContent>
          <LoginButton redirectTo={continueUrl} />
        </CardContent>
      </Card>
    </div>
  );
}
