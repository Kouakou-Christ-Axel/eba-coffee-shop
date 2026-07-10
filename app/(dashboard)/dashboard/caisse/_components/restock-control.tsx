'use client';

import { useState } from 'react';
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
  Button,
  NumberInput,
} from '@heroui/react';
import { PackagePlus } from 'lucide-react';
import type { RestockRef } from '@/lib/caisse-restock';
import { restockRequest } from '@/lib/caisse-restock';

type Props = {
  body: RestockRef;
  /** Stock disponible actuel (pré-remplit le champ). null = illimité. */
  currentStock: number | null;
  /** Callback quand la mise à jour a réussi : le nouveau stock persisté. */
  onDone: (stockQuantity: number | null) => void;
  /** Libellé du déclencheur (défaut « Réappro »). */
  label?: string;
};

/**
 * Bouton compact de réappro rapide (caisse) : ouvre un petit popover où le
 * caissier DÉFINIT directement le nombre disponible (valeur absolue, pas un
 * ajout), appelle `/api/caisse/restock`, puis remonte le nouveau stock au
 * parent. Sert le cas « une fournée de tartelettes sort de cuisine, on fixe le
 * nombre restant en un geste depuis la caisse ».
 */
export function RestockControl({
  body,
  currentStock,
  onDone,
  label = 'Réappro',
}: Props) {
  const [open, setOpen] = useState(false);
  const [stock, setStock] = useState<number>(currentStock ?? 0);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // À l'ouverture, (ré)initialise le champ sur le stock actuel pour que le
  // caissier ajuste depuis la valeur réelle (géré à l'événement, pas via un
  // effet, pour éviter un setState en cascade).
  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setStock(currentStock ?? 0);
      setError(null);
    }
  }

  async function confirm() {
    const amount = Math.floor(stock);
    if (!Number.isFinite(amount) || amount < 0) {
      setError('Nombre invalide');
      return;
    }
    setPending(true);
    setError(null);
    const result = await restockRequest({ ...body, stock: amount });
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onDone(result.stockQuantity);
    setOpen(false);
  }

  return (
    <Popover
      isOpen={open}
      onOpenChange={handleOpenChange}
      placement="bottom-end"
      showArrow
    >
      <PopoverTrigger>
        <Button
          size="sm"
          variant="flat"
          color="secondary"
          startContent={<PackagePlus className="size-3.5" />}
        >
          {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-3">
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium text-foreground/70">
            Nombre disponible
          </p>
          <NumberInput
            aria-label="Nombre disponible en stock"
            size="sm"
            minValue={0}
            maxValue={100_000}
            step={1}
            value={stock}
            onValueChange={(v) => setStock(typeof v === 'number' ? v : stock)}
          />
          {error && <p className="text-xs text-danger">{error}</p>}
          <Button
            size="sm"
            color="primary"
            className="w-full"
            isLoading={pending}
            onPress={confirm}
          >
            Mettre à jour le stock
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
