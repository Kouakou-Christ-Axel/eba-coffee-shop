'use client';

import { useEffect } from 'react';
import type { PublicTiktokVideo } from '@/lib/tiktok';

type TiktokEmbedProps = {
  video: PublicTiktokVideo;
};

const TIKTOK_EMBED_SCRIPT_SRC = 'https://www.tiktok.com/embed.js';

// Balise attendue par le script officiel `https://www.tiktok.com/embed.js`
// (chargé une première fois par `TiktokEmbedRow`) : il scanne le DOM à son
// propre chargement et remplace chaque `blockquote.tiktok-embed` par un
// iframe — mais ne réobserve PAS les mutations ultérieures du DOM, contrairement
// à ce qu'on avait supposé. Un blockquote monté après ce premier passage
// (lecture au clic, cf. `TiktokEmbedLazy`) reste donc affiché en repli brut
// (texte + lien) indéfiniment. On force donc un nouveau passage du script à
// chaque montage : réinjecter la balise `<script>` réexécute le bundle et
// relance son scan du DOM ; le fichier est déjà en cache navigateur depuis le
// premier chargement, donc ce réenregistrement est quasi instantané.
function TiktokEmbed({ video }: TiktokEmbedProps) {
  // La légende manuelle prime ; à défaut, on retombe sur la légende
  // d'origine TikTok (récupérée automatiquement via l'oEmbed, cf.
  // lib/tiktok-mutations.ts) plutôt que de n'afficher aucun texte.
  const caption = video.caption ?? video.oembedTitle;

  useEffect(() => {
    const script = document.createElement('script');
    script.src = TIKTOK_EMBED_SCRIPT_SRC;
    script.async = true;
    document.body.appendChild(script);
    return () => {
      script.remove();
    };
  }, []);

  return (
    <blockquote
      className="tiktok-embed overflow-hidden rounded-2xl border border-default-200/60 shadow-sm"
      cite={video.url}
      data-video-id={video.videoId}
      style={{ width: 325 }}
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
