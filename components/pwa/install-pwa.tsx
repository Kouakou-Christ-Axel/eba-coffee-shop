'use client';

import { Modal, ModalContent, ModalHeader, ModalBody } from '@heroui/react';
import { InstallBanner } from './install/install-banner';
import { AndroidSteps, DesktopSteps, IosSteps } from './install/install-steps';
import { useInstallPwa } from './install/use-install-pwa';

export default function InstallPwa() {
  const pwa = useInstallPwa();
  const { platform } = pwa;

  return (
    <>
      <InstallBanner
        visible={pwa.isBannerVisible}
        onInstall={pwa.handleInstallClick}
        onDismiss={pwa.dismiss}
      />

      <Modal
        isOpen={pwa.isOpen}
        onOpenChange={pwa.onOpenChange}
        placement="center"
        backdrop="blur"
        scrollBehavior="inside"
      >
        <ModalContent>
          {() => (
            <>
              <ModalHeader className="flex flex-col gap-1">
                Installer EBA Coffee Shop
                <span className="text-sm font-normal text-default-500">
                  {platform === 'ios'
                    ? 'Sur iPhone / iPad avec Safari'
                    : 'Sur votre appareil'}
                </span>
              </ModalHeader>
              <ModalBody className="pb-6">
                {platform === 'ios' ? (
                  <IosSteps />
                ) : platform === 'android' ? (
                  <AndroidSteps />
                ) : (
                  <DesktopSteps />
                )}
              </ModalBody>
            </>
          )}
        </ModalContent>
      </Modal>
    </>
  );
}
