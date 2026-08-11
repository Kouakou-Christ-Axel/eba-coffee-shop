'use client';

// Confirmation stylée, en remplacement de `window.confirm()`.
//
// Pourquoi : `confirm()` bloque le thread, ignore le thème et s'affiche comme
// une alerte navigateur au milieu d'une tablette de comptoir — là où le reste
// de la caisse est en modales HeroUI. Le personnel finit par la valider en
// réflexe, ce qui est précisément ce qu'une confirmation doit éviter.
//
// L'API reste promise-based pour que les appelants gardent leur forme :
//
//   const { confirm, confirmDialog } = useConfirmDialog();
//   if (!(await confirm({ message: '…' }))) return;
//   …
//   return <>{…}{confirmDialog}</>;

import { useCallback, useRef, useState } from 'react';
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
} from '@heroui/react';

export type ConfirmOptions = {
  /** Titre court. Par défaut « Confirmer ». */
  title?: string;
  /** Corps du message. Les retours à la ligne sont préservés. */
  message: string;
  /** Libellé du bouton de confirmation. Par défaut « Confirmer ». */
  confirmLabel?: string;
  /** Libellé du bouton d'abandon. Par défaut « Annuler ». */
  cancelLabel?: string;
  /** Action destructive (remboursement, annulation) : bouton rouge. */
  destructive?: boolean;
};

export function useConfirmDialog() {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolveRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback((opts: ConfirmOptions) => {
    setOptions(opts);
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
    });
  }, []);

  const settle = useCallback((value: boolean) => {
    setOptions(null);
    resolveRef.current?.(value);
    resolveRef.current = null;
  }, []);

  const confirmDialog = (
    <Modal
      isOpen={options !== null}
      onClose={() => settle(false)}
      placement="center"
      size="sm"
    >
      <ModalContent>
        <ModalHeader>{options?.title ?? 'Confirmer'}</ModalHeader>
        <ModalBody>
          {/* `whitespace-pre-line` : les messages portent des retours à la
              ligne, hérités des anciens `confirm()`. */}
          <p className="whitespace-pre-line text-sm">{options?.message}</p>
        </ModalBody>
        <ModalFooter>
          <Button color="default" variant="light" onPress={() => settle(false)}>
            {options?.cancelLabel ?? 'Annuler'}
          </Button>
          <Button
            color={options?.destructive ? 'danger' : 'primary'}
            onPress={() => settle(true)}
          >
            {options?.confirmLabel ?? 'Confirmer'}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );

  return { confirm, confirmDialog };
}
