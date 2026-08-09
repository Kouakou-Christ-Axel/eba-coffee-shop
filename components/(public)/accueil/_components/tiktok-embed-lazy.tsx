'use client';

import { useEffect, useRef, useState } from 'react';
import { Play } from 'lucide-react';
import { MediaImage } from '@/components/ui/media-image';
import type { PublicTiktokVideo } from '@/lib/tiktok';
import TiktokEmbed from './tiktok-embed';

type TiktokEmbedLazyProps = {
  video: PublicTiktokVideo;
};

// Le lecteur TikTok officiel (`embed.js`) déclenche côté TikTok une
// protection anti-surcharge ("overload protect") quand plusieurs vidéos
// tentent de démarrer d'affilée sur la même page — les vignettes restent
// alors bloquées en chargement indéfiniment. On évite donc de monter le
// blockquote (et donc son iframe) tant que le visiteur n'a pas explicitement
// demandé la lecture, via la miniature rapatriée à la création (cf.
// lib/tiktok-oembed.ts) : au plus une vidéo réelle est chargée à la fois,
// quel que soit le scroll.
function TiktokEmbedLazy({ video }: TiktokEmbedLazyProps) {
  const [isPlaying, setIsPlaying] = useState(false);

  if (isPlaying) {
    return (
      <div className="shrink-0 snap-start">
        <TiktokEmbed video={video} />
      </div>
    );
  }

  if (!video.thumbnailUrl) {
    // Repli quand l'oEmbed n'a pas fourni de miniature (best-effort, cf.
    // lib/tiktok-oembed.ts) : on retombe sur l'ancien chargement automatique
    // à l'approche du viewport, faute de vignette à afficher.
    return <ViewportTriggeredEmbed video={video} />;
  }

  const caption = video.caption ?? video.oembedTitle;

  return (
    <div className="shrink-0 snap-start">
      <button
        type="button"
        onClick={() => setIsPlaying(true)}
        aria-label={
          caption ? `Lire la vidéo TikTok : ${caption}` : 'Lire la vidéo TikTok'
        }
        className="group relative block overflow-hidden rounded-2xl border border-default-200/60 shadow-sm"
        style={{ width: 325, aspectRatio: '9 / 16' }}
      >
        <MediaImage
          src={video.thumbnailUrl}
          alt=""
          fill
          sizes="325px"
          className="object-cover"
        />
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
      </button>
    </div>
  );
}

function ViewportTriggeredEmbed({ video }: TiktokEmbedLazyProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isVisible) return;
    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '200px' }
    );
    observer.observe(node);

    return () => observer.disconnect();
  }, [isVisible]);

  return (
    <div ref={ref} className="shrink-0 snap-start">
      {isVisible ? (
        <TiktokEmbed video={video} />
      ) : (
        <div
          aria-hidden="true"
          className="animate-pulse rounded-2xl border border-default-200/60 bg-content1"
          style={{ width: 325, aspectRatio: '9 / 16' }}
        />
      )}
    </div>
  );
}

export default TiktokEmbedLazy;
