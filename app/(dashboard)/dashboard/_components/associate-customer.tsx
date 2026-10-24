'use client';

// Modale d'association d'un client à une commande : recherche CRM, saisie d'un
// téléphone, ou détachement. `action` est injectée (la cuisine passe
// `setOrderCustomerFromKitchen`, même patron que `EncaisserButton`).

import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
} from '@heroui/react';
import { UserPlus, UserCog, X } from 'lucide-react';
import { formatPhoneForDisplay } from '@/lib/phone';
import { setOrderCustomerAction } from '../commandes/actions';
import type { SetOrderCustomerInput } from '@/lib/schemas/order';
import { CustomerSearchSection } from './associate/customer-search-section';
import { ManualCustomerSection } from './associate/manual-customer-section';
import { useAssociateCustomer } from './associate/use-associate-customer';

export type AssociateCustomerAction = (
  orderId: string,
  input: SetOrderCustomerInput
) => Promise<{ error: string } | undefined>;

type Props = {
  orderId: string;
  /** Client déjà lié (fiche CRM), null si commande anonyme. */
  currentCustomerId: string | null;
  currentName: string | null;
  currentPhone: string | null;
  action?: AssociateCustomerAction;
  /**
   * Ouverture pilotée de l'extérieur : le bouton déclencheur est alors masqué
   * (l'appelant a son propre point d'entrée, ex. une entrée de menu).
   */
  controlled?: { isOpen: boolean; setIsOpen: (open: boolean) => void };
};

export function AssociateCustomer({
  orderId,
  currentCustomerId,
  currentName,
  currentPhone,
  action = setOrderCustomerAction,
  controlled,
}: Props) {
  const state = useAssociateCustomer({ orderId, action, controlled });
  const { isOpen, setIsOpen, error, isPending, handleClose, submit } = state;

  const isLinked = currentCustomerId !== null;

  return (
    <>
      {!controlled && (
        <Button
          type="button"
          size="sm"
          variant="flat"
          startContent={
            isLinked ? (
              <UserCog className="h-4 w-4" />
            ) : (
              <UserPlus className="h-4 w-4" />
            )
          }
          onPress={() => setIsOpen(true)}
        >
          {isLinked ? 'Modifier le client' : 'Associer un client'}
        </Button>
      )}

      <Modal
        isOpen={isOpen}
        onClose={handleClose}
        size="lg"
        scrollBehavior="inside"
      >
        <ModalContent>
          <ModalHeader className="flex flex-col gap-1">
            Associer un client
            <span className="text-sm font-normal text-default-500">
              {isLinked
                ? `Actuellement : ${currentName || 'Sans nom'} · ${
                    currentPhone ? formatPhoneForDisplay(currentPhone) : '—'
                  }`
                : 'Commande anonyme'}
            </span>
          </ModalHeader>

          <ModalBody className="gap-4">
            {error && (
              <p className="rounded-medium bg-danger-50 px-3 py-2 text-sm text-danger">
                {error}
              </p>
            )}

            <CustomerSearchSection
              state={state}
              currentCustomerId={currentCustomerId}
            />

            <ManualCustomerSection state={state} />
          </ModalBody>

          <ModalFooter className="justify-between">
            {isLinked ? (
              <Button
                type="button"
                color="danger"
                variant="light"
                startContent={<X className="h-4 w-4" />}
                isDisabled={isPending}
                onPress={() => submit({ customerId: null })}
              >
                Détacher
              </Button>
            ) : (
              <span />
            )}
            <Button
              type="button"
              variant="flat"
              isDisabled={isPending}
              onPress={handleClose}
            >
              Fermer
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}
