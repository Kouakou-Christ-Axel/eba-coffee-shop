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
  /** Callback quand la réappro a réussi : le nouveau stock persisté. */
  onDone: (stockQuantity: number | null) => void;
  /** Quantité proposée par défaut (taille d'une fournée typique). */
  defaultDelta?: number;
  /** Libellé du déclencheur (défaut « Réappro »). */
  label?: string;
};

/**
 * Bouton compact de réappro rapide (caisse) : ouvre un petit popover avec une
 * quantité (fournée) à ajouter, appelle `/api/caisse/restock`, puis remonte le
 * nouveau stock au parent. Sert le cas « une fournée de tartelettes sort de
 * cuisine, on la recrédite en un geste depuis la caisse ».
 */
export function RestockControl({
  body,
  onDone,
  defaultDelta = 6,
  label = 'Réappro',
}: Props) {
  const [open, setOpen] = useState(false);
  const [delta, setDelta] = useState<number>(defaultDelta);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    const amount = Math.floor(delta);
    if (!Number.isFinite(amount) || amount < 1) {
      setError('Quantité invalide');
      return;
    }
    setPending(true);
    setError(null);
    const result = await restockRequest({ ...body, delta: amount });
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
      onOpenChange={setOpen}
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
            Quantité à ajouter au stock
          </p>
          <NumberInput
            aria-label="Quantité à réapprovisionner"
            size="sm"
            minValue={1}
            maxValue={500}
            step={1}
            value={delta}
            onValueChange={(v) => setDelta(typeof v === 'number' ? v : delta)}
          />
          {error && <p className="text-xs text-danger">{error}</p>}
          <Button
            size="sm"
            color="primary"
            className="w-full"
            isLoading={pending}
            onPress={confirm}
          >
            Ajouter au stock
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
