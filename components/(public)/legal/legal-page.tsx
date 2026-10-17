// components/(public)/legal/legal-page.tsx
//
// Gabarit commun des pages légales (/cookies, /mentions-legales,
// /confidentialite, /cgv) : fil d'Ariane JSON-LD, titre, chapô, sections.

import { BreadcrumbJsonLd } from '@/components/(public)/breadcrumb-json-ld';

export function LegalSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-8">
      <h2 className="text-xl font-semibold tracking-tight text-foreground">
        {title}
      </h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-foreground/75">
        {children}
      </div>
    </section>
  );
}

export function LegalPage({
  title,
  path,
  intro,
  children,
}: {
  title: string;
  path: string;
  intro: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-3xl px-4 pb-20 pt-28 sm:px-6 sm:pt-32">
      {/* « Accueil » est déjà ajouté par buildBreadcrumbJsonLd. */}
      <BreadcrumbJsonLd items={[{ name: title, path }]} />
      <h1 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
        {title}
      </h1>
      <p className="mt-4 text-sm leading-relaxed text-foreground/75">{intro}</p>
      {children}
    </div>
  );
}

/** Valeur légale, ou « à compléter » tant que le commerce ne l'a pas saisie. */
export function LegalValue({ value }: { value: string }) {
  return value ? (
    <>{value}</>
  ) : (
    <span className="italic text-foreground/50">à compléter</span>
  );
}

export function LegalLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      className="underline underline-offset-2 transition-colors hover:text-primary"
    >
      {children}
    </a>
  );
}
