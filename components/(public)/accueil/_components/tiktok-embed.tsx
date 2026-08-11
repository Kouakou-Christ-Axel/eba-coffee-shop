'use client';

import type { PublicTiktokVideo } from '@/lib/tiktok';
import { TIKTOK_EMBED_HEIGHT, TIKTOK_EMBED_WIDTH } from '@/config/constants';

type TiktokEmbedProps = {
  video: PublicTiktokVideo;
};

// Lecteur TikTok monté directement, sans passer par le script officiel
// `https://www.tiktok.com/embed.js`.
//
// Ce script ne fait qu'une chose pour nous : scanner le DOM et remplacer
// chaque `blockquote.tiktok-embed` par un iframe `embed/v2` (cf. le
// commentaire CSP de next.config.ts). Or il ne scanne qu'à son propre
// chargement et n'observe pas les mutations suivantes — un blockquote monté
// au clic n'était donc jamais converti et restait en repli brut (texte +
// lien). Construire l'iframe nous-mêmes supprime à la fois ce bug et le
// téléchargement du bundle (~500 kB) : plus aucun JS tiers sur la page.
function TiktokEmbed({ video }: TiktokEmbedProps) {
  const caption = video.caption ?? video.oembedTitle;

  return (
    <iframe
      src={`https://www.tiktok.com/embed/v2/${video.videoId}`}
      title={
        caption ??
        `Vidéo TikTok${video.authorName ? ` de @${video.authorName}` : ''}`
      }
      width={TIKTOK_EMBED_WIDTH}
      height={TIKTOK_EMBED_HEIGHT}
      allow="encrypted-media; fullscreen; picture-in-picture"
      className="rounded-2xl border border-default-200/60 shadow-sm"
    />
  );
}

export default TiktokEmbed;
