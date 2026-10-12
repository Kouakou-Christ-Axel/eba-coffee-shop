import React from 'react';
import {
  IconDownload,
  IconShare3,
  IconSquareRoundedPlus,
  IconDotsVertical,
} from '@tabler/icons-react';

function Step({
  index,
  icon,
  children,
}: {
  index: number;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <li className="flex items-start gap-3">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
        {index}
      </span>
      <span className="flex flex-wrap items-center gap-1.5 pt-0.5 text-sm text-foreground">
        {children}
        {icon}
      </span>
    </li>
  );
}

export function IosSteps() {
  return (
    <ol className="space-y-4">
      <Step
        index={1}
        icon={<IconShare3 size={18} className="text-primary" aria-hidden />}
      >
        Ouvrez le site dans <strong>Safari</strong>, puis touchez le bouton
        <strong>Partager</strong>
      </Step>
      <Step
        index={2}
        icon={
          <IconSquareRoundedPlus
            size={18}
            className="text-primary"
            aria-hidden
          />
        }
      >
        Faites défiler et choisissez{' '}
        <strong>« Sur l&apos;écran d&apos;accueil »</strong>
      </Step>
      <Step index={3}>
        Touchez <strong>Ajouter</strong> en haut à droite. L&apos;icône EBA
        apparaît sur votre écran d&apos;accueil&nbsp;!
      </Step>
    </ol>
  );
}

export function AndroidSteps() {
  return (
    <ol className="space-y-4">
      <Step
        index={1}
        icon={
          <IconDotsVertical size={18} className="text-primary" aria-hidden />
        }
      >
        Dans <strong>Chrome</strong>, touchez le menu (les trois points en haut
        à droite)
      </Step>
      <Step index={2}>
        Choisissez <strong>« Installer l&apos;application »</strong> (ou «
        Ajouter à l&apos;écran d&apos;accueil »)
      </Step>
      <Step index={3}>
        Confirmez avec <strong>Installer</strong>. L&apos;app EBA apparaît avec
        vos autres applications&nbsp;!
      </Step>
    </ol>
  );
}

export function DesktopSteps() {
  return (
    <ol className="space-y-4">
      <Step
        index={1}
        icon={<IconDownload size={18} className="text-primary" aria-hidden />}
      >
        Dans la barre d&apos;adresse (Chrome / Edge), cliquez sur l&apos;icône
        d&apos;installation
      </Step>
      <Step index={2}>
        Cliquez sur <strong>Installer</strong> dans la fenêtre qui apparaît.
      </Step>
      <Step index={3}>
        EBA s&apos;ouvre alors dans sa propre fenêtre, comme une application.
      </Step>
    </ol>
  );
}
