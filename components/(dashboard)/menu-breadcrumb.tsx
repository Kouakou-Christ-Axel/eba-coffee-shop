// Fil d'Ariane de la section menu. `BackButton` dit « revenir en arrière »,
// le fil d'Ariane dit « où je suis » : les deux cohabitent sur les pages
// profondes (catégorie, fiche produit), où la hiérarchie n'est autrement
// visible nulle part.

import Link from 'next/link';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';

export type Crumb = { label: string; href?: string };

export function MenuBreadcrumb({ items }: { items: Crumb[] }) {
  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link href="/dashboard/menu">Menu</Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        {items.map((item, idx) => (
          <BreadcrumbItem key={`${item.label}-${idx}`}>
            <BreadcrumbSeparator />
            {item.href && idx < items.length - 1 ? (
              <BreadcrumbLink asChild>
                <Link href={item.href}>{item.label}</Link>
              </BreadcrumbLink>
            ) : (
              <BreadcrumbPage>{item.label}</BreadcrumbPage>
            )}
          </BreadcrumbItem>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
