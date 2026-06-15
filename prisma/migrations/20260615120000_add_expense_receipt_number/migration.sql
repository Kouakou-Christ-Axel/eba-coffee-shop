-- Numérotation des reçus de dépense (DEP-YYYY-MM-NNNN), avec rétroactivité.
--
-- Stratégie sûre en prod :
--   1) on ajoute les colonnes en NULLABLE (l'ALTER ne peut pas poser NOT NULL
--      sur une table déjà remplie sans valeur par défaut) ;
--   2) on BACKFILL chaque dépense existante : numérotation chronologique par
--      mois civil de la `date` (ordre date ASC, createdAt ASC, id ASC) ;
--   3) on durcit en NOT NULL ;
--   4) on pose les contraintes d'unicité (après le backfill pour éviter tout
--      conflit pendant le remplissage).

-- 1) Colonnes (nullable le temps du backfill)
ALTER TABLE "expense" ADD COLUMN "receiptNo" TEXT;
ALTER TABLE "expense" ADD COLUMN "receiptPeriod" TEXT;
ALTER TABLE "expense" ADD COLUMN "receiptSeq" INTEGER;

-- 2) Backfill rétroactif : compteur remis à zéro chaque mois civil de la date.
WITH numbered AS (
  SELECT
    "id",
    to_char("date", 'YYYY-MM') AS period,
    ROW_NUMBER() OVER (
      PARTITION BY to_char("date", 'YYYY-MM')
      ORDER BY "date" ASC, "createdAt" ASC, "id" ASC
    ) AS seq
  FROM "expense"
)
UPDATE "expense" e
SET
  "receiptPeriod" = n.period,
  "receiptSeq" = n.seq,
  "receiptNo" = 'DEP-' || n.period || '-' || lpad(n.seq::text, 4, '0')
FROM numbered n
WHERE e."id" = n."id";

-- 3) Durcissement NOT NULL (toutes les lignes sont désormais renseignées)
ALTER TABLE "expense" ALTER COLUMN "receiptNo" SET NOT NULL;
ALTER TABLE "expense" ALTER COLUMN "receiptPeriod" SET NOT NULL;
ALTER TABLE "expense" ALTER COLUMN "receiptSeq" SET NOT NULL;

-- 4) Unicité (libellé global + couple mois/séquence)
CREATE UNIQUE INDEX "expense_receiptNo_key" ON "expense"("receiptNo");
CREATE UNIQUE INDEX "expense_receiptPeriod_receiptSeq_key" ON "expense"("receiptPeriod", "receiptSeq");
