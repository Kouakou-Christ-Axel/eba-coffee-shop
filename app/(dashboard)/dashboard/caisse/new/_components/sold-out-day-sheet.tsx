'use client';

// Filet de rattrapage : « Épuisé aujourd'hui — pour quel jour ? »
//
// Le caissier reste sur « Maintenant » par défaut, et c'est bien : c'est le cas
// courant. Mais quand il tape un produit épuisé, l'ancien comportement — une
// tuile grisée qui ne réagit pas — ne lui disait rien de la seule chose qui
// compte : ce produit sera disponible demain.
//
// Cette feuille pose la question, et le tap n'est jamais perdu : après le
// choix, l'article est ajouté comme si de rien n'était (cf.
// `resolveSoldOutPrompt`, lib/hooks/use-new-order.ts).

import { useState } from 'react';
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
} from '@heroui/react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  abidjanDatetimeLocalToISO,
  shiftDateString,
  todayDateString,
} from '@/lib/timezone';
import { DEFERRED_PICKUP_DEFAULT_TIME } from '@/config/constants';
import type { Product } from '@/config/menu';

type Props = {
  /** Produit épuisé tapé, ou `null` si la feuille est fermée. */
  product: Product | null;
  /** Le caissier a choisi un jour : ISO du créneau retenu. */
  onSelectDay: (iso: string) => void;
  onDismiss: () => void;
  /** Le panier contient déjà des articles : la bascule les concerne tous. */
  cartHasItems: boolean;
};

export function SoldOutDaySheet({
  product,
  onSelectDay,
  onDismiss,
  cartHasItems,
}: Props) {
  const today = todayDateString();
  const [customDay, setCustomDay] = useState(shiftDateString(today, 2));

  function pick(day: string) {
    const iso = abidjanDatetimeLocalToISO(
      `${day}T${DEFERRED_PICKUP_DEFAULT_TIME}`
    );
    if (iso) onSelectDay(iso);
  }

  return (
    <Modal
      isOpen={product !== null}
      onClose={onDismiss}
      placement="center"
      size="sm"
    >
      <ModalContent>
        <ModalHeader>Épuisé aujourd’hui</ModalHeader>
        <ModalBody className="gap-3">
          <p className="text-sm">
            <span className="font-semibold">{product?.name}</span> n’est plus
            disponible aujourd’hui. Pour quel jour voulez-vous le commander ?
          </p>
          {cartHasItems && (
            <p className="text-sm text-muted-foreground">
              Toute la commande passera à ce jour.
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              color="primary"
              onPress={() => pick(shiftDateString(today, 1))}
            >
              Demain
            </Button>
            <Button
              variant="flat"
              onPress={() => pick(shiftDateString(today, 2))}
            >
              Après-demain
            </Button>
          </div>
          <div className="grid gap-1">
            <Label
              htmlFor="sold-out-day"
              className="text-xs text-muted-foreground"
            >
              Autre date
            </Label>
            <div className="flex gap-2">
              <Input
                id="sold-out-day"
                type="date"
                value={customDay}
                min={shiftDateString(today, 1)}
                onChange={(e) => setCustomDay(e.target.value)}
              />
              <Button variant="bordered" onPress={() => pick(customDay)}>
                Choisir
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Le stock d’aujourd’hui ne sera pas décompté : la marchandise sera
            produite pour cette date.
          </p>
        </ModalBody>
        <ModalFooter>
          <Button variant="light" onPress={onDismiss}>
            Annuler
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
