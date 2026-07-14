// components/(public)/breadcrumb-json-ld.tsx
//
// Rendu du JSON-LD `BreadcrumbList` (lib/json-ld.ts::buildBreadcrumbJsonLd)
// sur les pages publiques secondaires (/carte, /sondages, /sondages/[pollId],
// /a-propos, /le-lieu, /contact). Petit composant partagé pour éviter de
// répéter le `<script dangerouslySetInnerHTML>` à chaque page.

import { buildBreadcrumbJsonLd, type BreadcrumbItem } from '@/lib/json-ld';

export function BreadcrumbJsonLd({ items }: { items: BreadcrumbItem[] }) {
  const breadcrumbJsonLd = buildBreadcrumbJsonLd(items);
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
    />
  );
}
