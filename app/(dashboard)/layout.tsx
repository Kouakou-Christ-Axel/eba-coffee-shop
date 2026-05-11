import React from 'react';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import Link from 'next/link';
import { auth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    redirect('/login');
  }

  if (session.user.role !== 'ADMIN') {
    redirect('/');
  }

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="flex w-56 flex-col border-r">
        <div className="p-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Dashboard
          </p>
        </div>
        <Separator />
        <nav className="flex flex-1 flex-col gap-1 p-2">
          <Button variant="ghost" asChild className="w-full justify-start">
            <Link href="/dashboard/commandes">Commandes</Link>
          </Button>
          <Button variant="ghost" asChild className="w-full justify-start">
            <Link href="/dashboard/menu">Menu</Link>
          </Button>
        </nav>
      </aside>
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}
