'use client';

import { useEffect, useRef, useState } from 'react';
import type { PublicTiktokVideo } from '@/lib/tiktok';
import TiktokEmbed from './tiktok-embed';

type TiktokEmbedLazyProps = {
  video: PublicTiktokVideo;
};

// Ne monte le blockquote TikTok (et ne déclenche donc son iframe) qu'à
// l'approche du viewport : sur la rangée complète, ça évite de charger 4
// lecteurs TikTok d'un coup au chargement de la page. `embed.js` observe le
// DOM en continu, donc un blockquote monté après son premier passage est
// tout de même traité.
function TiktokEmbedLazy({ video }: TiktokEmbedLazyProps) {
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
