import React from 'react';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import Link from 'next/link';
import { auth } from '@/lib/auth';

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
    <div className="flex min-h-screen">
      <nav className="w-56 border-r bg-white p-6">
        <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-gray-400">
          Dashboard
        </p>
        <ul className="space-y-2">
          <li>
            <Link
              href="/dashboard/commandes"
              className="block rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
            >
              Commandes
            </Link>
          </li>
          <li>
            <Link
              href="/dashboard/menu"
              className="block rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
            >
              Menu
            </Link>
          </li>
        </ul>
      </nav>
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}
