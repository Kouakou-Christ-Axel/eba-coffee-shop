import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Hors ligne',
  description: 'Vous êtes actuellement hors ligne.',
  robots: { index: false, follow: false },
};

export default function OfflinePage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6 text-center">
      <Image
        src="/assets/logos/eba.svg"
        alt="EBA Coffee Shop"
        width={96}
        height={96}
        priority
      />
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold text-foreground">
          Vous êtes hors ligne
        </h1>
        <p className="max-w-sm text-balance text-default-600">
          Impossible de charger cette page sans connexion. Vérifiez votre réseau
          puis réessayez.
        </p>
      </div>
      <Link
        href="/"
        className="rounded-medium bg-primary px-6 py-3 font-medium text-primary-foreground"
      >
        Réessayer
      </Link>
    </main>
  );
}
