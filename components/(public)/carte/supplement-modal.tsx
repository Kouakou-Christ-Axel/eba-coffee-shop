// components/(public)/carte/supplement-modal.tsx
'use client';

import { Modal, ModalContent, ModalBody, ModalFooter } from '@heroui/react';
import {
  BOTTOM_SHEET_PLACEMENT,
  bottomSheetClassNames,
} from '@/lib/bottom-sheet';
import { ExtrasSection } from './_components/supplement-modal/extras-section';
import { ModalFooterBar } from './_components/supplement-modal/modal-footer-bar';
import { ModalHero } from './_components/supplement-modal/modal-hero';
import { SupplementGroupCard } from './_components/supplement-modal/supplement-group-card';
import type { SupplementModalProps } from './_components/supplement-modal/types';
import { useSupplementModal } from './_components/supplement-modal/use-supplement-modal';

function SupplementModal(props: SupplementModalProps) {
  const { product, isOpen, onClose } = props;
  const modal = useSupplementModal(props);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      // Bottom sheet plein écran sur mobile, dialogue centré sur desktop
      // (voir lib/bottom-sheet.ts).
      placement={BOTTOM_SHEET_PLACEMENT}
      size="md"
      scrollBehavior="inside"
      // La photo est collée aux bords : on remplace le bouton de fermeture
      // par défaut par le nôtre, posé en overlay sur l'image.
      hideCloseButton
      classNames={bottomSheetClassNames({ body: 'px-0 py-0' })}
    >
      <ModalContent>
        <ModalBody className="gap-0">
          <ModalHero product={product} onClose={onClose} />

          <div className="flex flex-col gap-3 px-6 pb-6 pt-2">
            {modal.productGroups.map((group) => (
              <SupplementGroupCard
                key={group.name}
                group={group}
                modal={modal}
              />
            ))}

            <ExtrasSection modal={modal} />
          </div>
        </ModalBody>

        <ModalFooter className="gap-3">
          <ModalFooterBar modal={modal} />
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

export default SupplementModal;
