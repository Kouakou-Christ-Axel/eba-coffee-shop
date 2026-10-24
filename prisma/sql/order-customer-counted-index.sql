-- Index couvrant partiel des stats clients (lib/customers/stats.ts).
--
-- Chaque ligne de /dashboard/clients calcule ses chiffres (commandes, total,
-- dernière commande) par une recherche sur `customerId`. Cet index :
--   - ne contient que les commandes COMPTÉES (même prédicat que COUNTED_ORDER,
--     lib/customers/stats-rules.ts — à garder identique) ;
--   - embarque `total` et `createdAt` : les agrégats se calculent sans lire la
--     table (Index Only Scan). Mesuré sur 300 000 commandes (meilleur de 5) :
--     tri par total acheté ~98 -> ~49 ms ; les chiffres d'une page (20 clients)
--     coûtent ~2 ms avec ou sans index — il sert surtout au tri sur une stat.
--
-- Prisma ne sait pas décrire un index partiel avec INCLUDE : il n'est donc pas
-- dans schema.prisma, et `prisma db push` ne le crée ni ne le supprime.
-- Idempotent (IF NOT EXISTS). Application : `pnpm db:indexes`.

CREATE INDEX IF NOT EXISTS order_customer_counted_idx
  ON "order" ("customerId") INCLUDE (total, "createdAt")
  WHERE status <> 'CANCELLED' AND ("paymentExpiresAt" IS NULL OR "isPaid");
