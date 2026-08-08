'use client';

import type { PublicTiktokVideo } from '@/lib/tiktok';

type TiktokEmbedProps = {
  video: PublicTiktokVideo;
};

// Balise attendue par le script officiel `https://www.tiktok.com/embed.js`
// (chargé une seule fois par `TiktokEmbedRow`) : il scanne le DOM à son
// chargement et remplace chaque `blockquote.tiktok-embed` par un iframe.
function TiktokEmbed({ video }: TiktokEmbedProps) {
  // La légende manuelle prime ; à défaut, on retombe sur la légende
  // d'origine TikTok (récupérée automatiquement via l'oEmbed, cf.
  // lib/tiktok-mutations.ts) plutôt que de n'afficher aucun texte.
  const caption = video.caption ?? video.oembedTitle;

  return (
    <blockquote
      className="tiktok-embed"
      cite={video.url}
      data-video-id={video.videoId}
      style={{ maxWidth: 605, minWidth: 325 }}
    >
      <section>
        {caption && <p>{caption}</p>}
        {video.authorName && <p>@{video.authorName}</p>}
        <a href={video.url} target="_blank" rel="noreferrer">
          Voir sur TikTok
        </a>
      </section>
    </blockquote>
  );
}

export default TiktokEmbed;
