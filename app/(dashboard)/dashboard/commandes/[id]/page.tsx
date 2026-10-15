import { notFound } from 'next/navigation';
import { getOrder } from '@/lib/orders';
import { getMenu } from '@/lib/menu';
import { getContactSettings } from '@/lib/contact-settings-db';
import { requireOrdersView, ROLE_GROUPS } from '@/lib/auth-helpers';
import type { CartItem } from '@/lib/cart-store';
import { normalizeSiteUrl } from '@/lib/site-url';
import type { OrderStatus } from '@/generated/prisma/client';
import { StatusButtons } from './status-buttons';
import { OrderCustomerCard } from './_components/order-customer-card';
import { OrderDetailsCard } from './_components/order-details-card';
import { OrderHeader } from './_components/order-header';
import { OrderItemsCard } from './_components/order-items-card';

export default async function CommandeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // Les 3 lectures sont indépendantes (menu et session ne dépendent pas de
  // `order`) : parallélisées pour éviter une waterfall à 3 allers-retours DB.
  const [order, menu, contactSettings, session] = await Promise.all([
    getOrder(id),
    getMenu(),
    getContactSettings(),
    // Garde de page : elle manquait, seul le layout dashboard filtrait et il
    // laisse passer les sept rôles staff. KITCHEN et COMPTABLE — sans lien vers
    // « Commandes » dans la barre latérale — atteignaient donc cette page par
    // l'URL, coûts et marges compris. Renvoie aussi la session, qui sert
    // ci-dessous (l'édition des métadonnées reste réservée à l'ADMIN).
    requireOrdersView(),
  ]);

  if (!order) {
    notFound();
  }

  const items = order.items as CartItem[];
  const isAdmin = session.user.role === 'ADMIN';
  const canCash = ROLE_GROUPS.CASHIER_PLUS.includes(session.user.role);
  // Coûts matière/emballage et marges : donnée de gestion, pas d'exploitation.
  // Un caissier encaisse sans avoir à connaître la marge du produit ; un
  // ANALYSTE lit les commandes sans accéder à la structure de coûts.
  const canSeeMargins = ROLE_GROUPS.MANAGER_PLUS.includes(session.user.role);
  const trackingUrl = process.env.NEXT_PUBLIC_SITE_URL
    ? `${normalizeSiteUrl(process.env.NEXT_PUBLIC_SITE_URL)}/commande/${order.id}`
    : undefined;

  return (
    <div className="space-y-6">
      <OrderHeader order={order} canCash={canCash} />

      <OrderCustomerCard order={order} canCash={canCash} />

      <OrderDetailsCard order={order} isAdmin={isAdmin} />

      <OrderItemsCard
        order={order}
        items={items}
        menu={menu}
        contactSettings={contactSettings}
        trackingUrl={trackingUrl}
        canCash={canCash}
        canSeeMargins={canSeeMargins}
      />

      {/* ANALYSTE est en lecture seule : le serveur refuse ses transitions,
          afficher les boutons ne produirait qu'un message d'erreur. */}
      {canCash && (
        <StatusButtons
          orderId={order.id}
          currentStatus={order.status as OrderStatus}
          isPaid={order.isPaid}
        />
      )}
    </div>
  );
}
