'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ProductRowActions } from './product-row-actions';

export type ProductRow = {
  id: string;
  name: string;
  price: number;
  coutMatiere: number;
  coutEmballage: number;
  imageUrl: string | null;
  available: boolean;
  featured: boolean;
  featuredBadge: string | null;
};

const priceFmt = new Intl.NumberFormat('fr-FR');
type Availability = 'all' | 'visible' | 'hidden';

export function ProductsTable({
  categoryId,
  products,
}: {
  categoryId: string;
  products: ProductRow[];
}) {
  const [query, setQuery] = useState('');
  const [availability, setAvailability] = useState<Availability>('all');
  const [featuredOnly, setFeaturedOnly] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => {
      if (q && !p.name.toLowerCase().includes(q)) return false;
      if (availability === 'visible' && !p.available) return false;
      if (availability === 'hidden' && p.available) return false;
      if (featuredOnly && !p.featured) return false;
      return true;
    });
  }, [products, query, availability, featuredOnly]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full sm:w-[260px]">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher un produit…"
            className="pl-8 h-9"
          />
        </div>

        <Tabs
          value={availability}
          onValueChange={(v) => setAvailability(v as Availability)}
        >
          <TabsList>
            <TabsTrigger value="all">Tous</TabsTrigger>
            <TabsTrigger value="visible">Visibles</TabsTrigger>
            <TabsTrigger value="hidden">Masqués</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-2">
          <Switch
            id="featured-only"
            checked={featuredOnly}
            onCheckedChange={setFeaturedOnly}
          />
          <Label htmlFor="featured-only" className="text-sm">
            En vedette
          </Label>
        </div>

        <span className="ml-auto text-sm text-muted-foreground">
          {filtered.length} / {products.length}
        </span>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Image</TableHead>
            <TableHead>Nom</TableHead>
            <TableHead>Prix</TableHead>
            <TableHead>Coûts</TableHead>
            <TableHead>Marge</TableHead>
            <TableHead>Statut</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map((p) => {
            const couts = p.coutMatiere + p.coutEmballage;
            const marge = p.price - couts;
            const pct = p.price > 0 ? Math.round((marge / p.price) * 100) : 0;
            return (
              <TableRow key={p.id}>
                <TableCell>
                  {p.imageUrl ? (
                    <Image
                      src={p.imageUrl}
                      alt={p.name}
                      width={48}
                      height={48}
                      className="size-12 rounded-md object-cover"
                    />
                  ) : (
                    <div className="size-12 rounded-md bg-muted" />
                  )}
                </TableCell>
                <TableCell className="font-medium">
                  <Link
                    href={`/dashboard/menu/${categoryId}/produits/${p.id}`}
                    className="hover:underline"
                  >
                    {p.name}
                  </Link>
                </TableCell>
                <TableCell>{priceFmt.format(p.price)} FCFA</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {couts > 0 ? (
                    <span>{priceFmt.format(couts)} FCFA</span>
                  ) : (
                    <span className="text-xs">—</span>
                  )}
                </TableCell>
                <TableCell>
                  {couts > 0 && p.price > 0 ? (
                    <span
                      className={
                        pct >= 50
                          ? 'text-sm font-medium text-green-600'
                          : pct >= 20
                            ? 'text-sm font-medium text-yellow-600'
                            : 'text-sm font-medium text-destructive'
                      }
                    >
                      {priceFmt.format(marge)} F ({pct}%)
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant={p.available ? 'default' : 'outline'}>
                      {p.available ? 'Visible' : 'Masqué'}
                    </Badge>
                    {p.featured && (
                      <Badge variant="secondary">
                        ★ {p.featuredBadge ?? 'Favori'}
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Button variant="ghost" size="sm" asChild>
                      <Link
                        href={`/dashboard/menu/${categoryId}/produits/${p.id}`}
                      >
                        Modifier
                      </Link>
                    </Button>
                    <ProductRowActions
                      id={p.id}
                      available={p.available}
                      featured={p.featured}
                    />
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
          {filtered.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={7}
                className="py-8 text-center text-sm text-muted-foreground"
              >
                {products.length === 0
                  ? 'Aucun produit dans cette catégorie.'
                  : 'Aucun produit ne correspond aux filtres.'}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
