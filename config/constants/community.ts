/** Sondages (vote générique + suggestions de la communauté). */
export const POLL_TITLE_MAX = 120;

export const POLL_DESCRIPTION_MAX = 500;

export const POLL_OPTION_LABEL_MAX = 80;

export const POLL_OPTION_DESCRIPTION_MAX = 300;

export const POLL_SUGGESTION_LABEL_MAX = 80;

export const POLL_SUGGESTION_DESCRIPTION_MAX = 300;

export const POLL_SUGGESTION_SUBMITTER_NAME_MAX = 60;

export const POLL_REJECTION_REASON_MAX = 300;

export const POLL_VOTER_TOKEN_MAX = 100;

/** Taille de page par défaut pour les listes paginées (dashboard). */
export const POLL_LIST_PAGE_SIZE = 20;

/** Longueur max de la légende personnalisée d'une vidéo TikTok embarquée. */
export const TIKTOK_CAPTION_MAX = 300;

export const TIKTOK_HOME_DISPLAY_MAX = 4;

/** Dimensions du lecteur TikTok embarqué. */
export const TIKTOK_EMBED_WIDTH = 325;

export const TIKTOK_EMBED_HEIGHT = 739;

/** Liste publique des sondages (`/sondages`) : passée en ISR plutôt qu'en `force-dynamic` pour un TTFB quasi instantané côté public. */
export const POLLS_REVALIDATE_SECONDS = 60;
