// components/(public)/carte/_components/bottom-sheet.ts
//
// Présentation des modales du tunnel de commande : **bottom sheet plein écran
// sur mobile**, dialogue centré sur desktop. C'est le geste natif attendu sur
// téléphone (Uber Eats, Deliveroo) — une boîte flottante au milieu de l'écran
// y fait pop-up web, et surtout elle gaspille la hauteur dont la fiche produit
// a besoin pour montrer une photo ET ses options sans scroller.
//
// Tout passe par des classes, sans détection de viewport en JS : HeroUI pilote
// son animation d'ouverture avec des variables CSS (`--slide-exit` sert à la
// fois de point de départ à l'entrée et d'arrivée à la sortie), on les
// surcharge donc en `max-sm:` comme le reste. Aucun hook de media query, donc
// aucun risque de désaccord serveur/client.

import { cn } from '@/lib/utils';

/** `auto` = ancré en bas sous 640 px, centré au-dessus (variante HeroUI). */
export const BOTTOM_SHEET_PLACEMENT = 'auto' as const;

type ModalSlots =
  | 'wrapper'
  | 'base'
  | 'header'
  | 'body'
  | 'footer'
  | 'closeButton';

// La feuille entre depuis le bas de l'écran et en ressort entièrement, au lieu
// du léger décalage de 80 px prévu par défaut pour une modale flottante.
const WRAPPER = 'max-sm:[--slide-exit:100%]';

// Plein écran sous 640 px : ni marge, ni largeur max, ni arrondi (les coins
// arrondis n'ont plus de sens quand la feuille touche les quatre bords), et on
// neutralise le plafond de hauteur posé par `scrollBehavior="inside"`.
const BASE =
  'max-sm:m-0 max-sm:h-[100dvh] max-sm:max-h-[100dvh] max-sm:w-screen max-sm:max-w-none max-sm:rounded-none';

// La feuille touche désormais les quatre bords : on réserve la place des zones
// système (indicateur d'accueil en bas, encoche en haut). Les `max(...)`
// gardent la valeur de base tant que `env()` vaut 0 — c'est le cas aujourd'hui,
// `viewportFit: 'cover'` n'étant pas activé dans `app/layout.tsx` ; ces
// réserves deviendront effectives le jour où il le sera.
const FOOTER = 'max-sm:pb-[max(1rem,env(safe-area-inset-bottom))]';
const HEADER = 'max-sm:pt-[max(1rem,env(safe-area-inset-top))]';
const CLOSE_BUTTON = 'max-sm:top-[max(0.25rem,env(safe-area-inset-top))]';

/** Décalage haut des contrôles posés en overlay sur une image pleine largeur
 * (bouton de fermeture, badge) — même réserve d'encoche, mais appliquée par le
 * composant lui-même puisqu'ils ne vivent dans aucun slot HeroUI. */
export const SHEET_OVERLAY_TOP =
  'top-[max(0.75rem,calc(env(safe-area-inset-top)+0.25rem))]';

/**
 * `classNames` d'une modale présentée en bottom sheet. Les classes propres à
 * l'appelant sont fusionnées par-dessus (twMerge) — passer `body`, `header`…
 * pour les ajuster sans perdre le comportement de feuille.
 */
export function bottomSheetClassNames(
  extra: Partial<Record<ModalSlots, string>> = {}
): Record<ModalSlots, string> {
  return {
    wrapper: cn(WRAPPER, extra.wrapper),
    base: cn(BASE, extra.base),
    header: cn(HEADER, extra.header),
    body: cn(extra.body),
    footer: cn(FOOTER, extra.footer),
    closeButton: cn(CLOSE_BUTTON, extra.closeButton),
  };
}
