-- Détail des dépenses par article + nature fixe/variable des catégories.
--
-- Migration 100 % ADDITIVE (aucun DROP, aucun ALTER destructif) : les dépenses
-- existantes et leur numérotation de reçu ne sont pas touchées. Compatible avec
-- l'ancien code (colonne nouvelle avec défaut, tables nouvelles ignorées).
-- NB : si tu déploies via `db push`, la migration n'est pas exécutée — le
-- schéma Prisma produit le même résultat. Après déploiement, lance
-- `pnpm db:backfill-expense-items` pour générer le détail des dépenses déjà
-- liées à des achats d'inventaire.

-- 1) Nature (fixe/variable) portée par la catégorie. Défaut VARIABLE : les
-- catégories existantes restent classées « variables », l'admin reclasse
-- Loyer/Salaires/Abonnements dans l'UI.
CREATE TYPE "ExpenseNature" AS ENUM ('FIXED', 'VARIABLE');
ALTER TABLE "expense_category"
  ADD COLUMN "nature" "ExpenseNature" NOT NULL DEFAULT 'VARIABLE';

-- 2) Référentiel d'articles de dépense (« Farine T45 », « Sucre », « Gaz »…).
CREATE TABLE "expense_article" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "nameNormalized" TEXT NOT NULL,
  "inventoryItemId" TEXT,
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "expense_article_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "expense_article_nameNormalized_key" ON "expense_article"("nameNormalized");
CREATE UNIQUE INDEX "expense_article_inventoryItemId_key" ON "expense_article"("inventoryItemId");
CREATE INDEX "expense_article_deletedAt_idx" ON "expense_article"("deletedAt");

-- FK conditionnelle : `inventory_item` a été créée via `db push` (pas de
-- dossier de migration). En prod elle existe ; sur une base vierge rejouée
-- depuis l'historique des migrations, elle n'existe pas encore — le `db push`
-- de synchronisation posera alors la contrainte.
DO $$
BEGIN
  IF to_regclass('"inventory_item"') IS NOT NULL THEN
    ALTER TABLE "expense_article"
      ADD CONSTRAINT "expense_article_inventoryItemId_fkey"
      FOREIGN KEY ("inventoryItemId") REFERENCES "inventory_item"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- 3) Lignes de détail optionnelles d'une dépense. Si des lignes existent,
-- sum(amount) == expense.amount (invariant imposé par les mutations).
CREATE TABLE "expense_item" (
  "id" TEXT NOT NULL,
  "expenseId" TEXT NOT NULL,
  "articleId" TEXT NOT NULL,
  "label" TEXT,
  "quantity" DECIMAL(12,3),
  "unit" TEXT,
  "unitPrice" INTEGER,
  "amount" INTEGER NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "expense_item_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "expense_item_expenseId_idx" ON "expense_item"("expenseId");
CREATE INDEX "expense_item_articleId_idx" ON "expense_item"("articleId");

ALTER TABLE "expense_item"
  ADD CONSTRAINT "expense_item_expenseId_fkey"
  FOREIGN KEY ("expenseId") REFERENCES "expense"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "expense_item"
  ADD CONSTRAINT "expense_item_articleId_fkey"
  FOREIGN KEY ("articleId") REFERENCES "expense_article"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
