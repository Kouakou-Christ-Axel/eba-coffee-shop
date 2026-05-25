-- Trigger Postgres : sur chaque écriture de `order`, émet NOTIFY orders_changed
-- (payload vide). Le listener côté app (lib/postgres-notify.ts) re-requête la file
-- et pousse via SSE.
--
-- Idempotent (CREATE OR REPLACE FUNCTION + DROP TRIGGER IF EXISTS), donc rejouable
-- sans erreur.
--
-- Application :
--   bunx prisma db execute --file prisma/sql/orders-notify-trigger.sql --schema prisma/schema.prisma

CREATE OR REPLACE FUNCTION notify_orders_changed()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM pg_notify('orders_changed', '');
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS order_changed_notify ON "order";

CREATE TRIGGER order_changed_notify
AFTER INSERT OR UPDATE OR DELETE ON "order"
FOR EACH ROW EXECUTE FUNCTION notify_orders_changed();
