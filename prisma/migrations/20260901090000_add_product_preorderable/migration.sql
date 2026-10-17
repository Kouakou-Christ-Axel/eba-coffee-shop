-- AlterTable
-- Précommande autorisée par produit : true (défaut) = comportement historique,
-- false = commandable uniquement pour le jour même côté public.
ALTER TABLE "Product" ADD COLUMN "preorderable" BOOLEAN NOT NULL DEFAULT true;
