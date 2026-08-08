// lib/tiktok-oembed.ts
//
// Appel best-effort à l'oEmbed public de TikTok pour enrichir automatiquement
// une vidéo embarquée (légende d'origine, auteur, miniature) à partir de sa
// seule URL — l'admin n'a rien à ressaisir. Ne doit JAMAIS bloquer la
// création/mise à jour d'une vidéo : toute erreur réseau/format dégrade
// silencieusement vers `null`, même posture que `lib/ai/payment-proof.ts`
// pour les appels IA en arrière-plan.

const TIKTOK_OEMBED_TIMEOUT_MS = 8000;

export type TiktokOEmbedResult = {
  title: string | null;
  authorName: string | null;
  thumbnailUrl: string | null;
};

export async function fetchTiktokOEmbed(
  url: string
): Promise<TiktokOEmbedResult | null> {
  try {
    const res = await fetch(
      `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`,
      { signal: AbortSignal.timeout(TIKTOK_OEMBED_TIMEOUT_MS) }
    );
    if (!res.ok) return null;

    const data = await res.json();
    return {
      title: typeof data.title === 'string' ? data.title : null,
      authorName:
        typeof data.author_name === 'string' ? data.author_name : null,
      thumbnailUrl:
        typeof data.thumbnail_url === 'string' ? data.thumbnail_url : null,
    };
  } catch {
    return null;
  }
}
