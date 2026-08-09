'use client';

import Script from 'next/script';
import { motion, useReducedMotion } from 'framer-motion';
import type { PublicTiktokVideo } from '@/lib/tiktok';
import TiktokEmbedLazy from './tiktok-embed-lazy';

type TiktokEmbedRowProps = {
  videos: PublicTiktokVideo[];
};

// Rangée scrollable horizontalement : les embeds TikTok imposent leur propre
// largeur fixe (325px, le minimum accepté par TikTok), incompatible avec une
// grille classique.
function TiktokEmbedRow({ videos }: TiktokEmbedRowProps) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      className="mt-8 md:mt-10"
      initial={reduceMotion ? undefined : { opacity: 0, y: 16 }}
      whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={reduceMotion ? undefined : { duration: 0.6, ease: 'easeOut' }}
    >
      <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2">
        {videos.map((video) => (
          <TiktokEmbedLazy key={video.id} video={video} />
        ))}
      </div>
      {/* Un seul chargement du script d'embed pour toute la rangée, quel que
          soit le nombre de vidéos : il scanne le DOM une fois chargé, puis
          observe les mutations pour traiter les embeds montés plus tard
          (cf. TiktokEmbedLazy). */}
      <Script src="https://www.tiktok.com/embed.js" strategy="lazyOnload" />
    </motion.div>
  );
}

export default TiktokEmbedRow;
