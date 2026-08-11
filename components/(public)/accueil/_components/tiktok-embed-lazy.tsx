'use client';

import { useState, type MouseEvent } from 'react';
import { Play } from 'lucide-react';
import { MediaImage } from '@/components/ui/media-image';
import type { PublicTiktokVideo } from '@/lib/tiktok';
import { TIKTOK_EMBED_WIDTH } from '@/config/constants';
import TiktokEmbed from './tiktok-embed';

type TiktokEmbedLazyProps = {
  video: PublicTiktokVideo;
};

// Le lecteur TikTok déclenche côté TikTok une protection anti-surcharge
// ("overload protect") quand plusieurs vidéos démarrent d'affilée sur la même
// page — les vignettes restent alors bloquées en chargement indéfiniment. On
// ne monte donc l'iframe qu'à la demande explicite du visiteur, derrière la
// miniature rapatriée à la création (cf. lib/tiktok-oembed.ts) : au chargement
// de l'accueil, la section ne coûte que ses images locales, aucun iframe.
//
// La vignette reste un vrai lien vers TikTok : sans JS (ou en clic milieu /
// ctrl-clic) elle ouvre la vidéo sur tiktok.com plutôt que de ne rien faire.
function TiktokEmbedLazy({ video }: TiktokEmbedLazyProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const caption = video.caption ?? video.oembedTitle;

  if (isPlaying) {
    return (
      <div className="shrink-0 snap-start">
        <TiktokEmbed video={video} />
      </div>
    );
  }

  const play = (e: MouseEvent<HTMLAnchorElement>) => {
    // Laisse le navigateur faire son travail sur un clic « ouvrir ailleurs ».
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) {
      return;
    }
    e.preventDefault();
    setIsPlaying(true);
  };

  return (
    <div className="shrink-0 snap-start">
      <a
        href={video.url}
        target="_blank"
        rel="noreferrer"
        onClick={play}
        aria-label={
          caption ? `Lire la vidéo TikTok : ${caption}` : 'Lire la vidéo TikTok'
        }
        className="group relative block overflow-hidden rounded-2xl border border-default-200/60 shadow-sm"
        style={{ width: TIKTOK_EMBED_WIDTH, aspectRatio: '9 / 16' }}
      >
        {video.thumbnailUrl ? (
          <MediaImage
            src={video.thumbnailUrl}
            alt=""
            fill
            sizes={`${TIKTOK_EMBED_WIDTH}px`}
            className="object-cover"
          />
        ) : (
          // Repli quand l'oEmbed n'a pas fourni de miniature (best-effort) :
          // un visuel maison plutôt qu'un cadre vide qui se lit comme cassé.
          <span
            aria-hidden="true"
            className="absolute inset-0 bg-[linear-gradient(135deg,rgba(247,239,232,1)_0%,rgba(233,220,240,1)_100%)]"
          />
        )}
        <span className="absolute inset-0 bg-black/25 transition-colors group-hover:bg-black/35" />
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white/90 shadow-md transition-transform group-hover:scale-105">
            <Play className="ml-1 h-6 w-6 fill-foreground text-foreground" />
          </span>
        </span>
        {(caption || video.authorName) && (
          <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-3 text-left text-xs text-white">
            {caption && <span className="line-clamp-2">{caption}</span>}
            {video.authorName && (
              <span className="mt-0.5 block opacity-80">
                @{video.authorName}
              </span>
            )}
          </span>
        )}
      </a>
    </div>
  );
}

export default TiktokEmbedLazy;
