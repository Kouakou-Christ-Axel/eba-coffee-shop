'use client';

import { motion, useReducedMotion } from 'framer-motion';
import type { PublicTiktokVideo } from '@/lib/tiktok';
import TiktokEmbedLazy from './tiktok-embed-lazy';

type TiktokEmbedRowProps = {
  videos: PublicTiktokVideo[];
};

// Rangée scrollable horizontalement : les lecteurs TikTok imposent leur propre
// largeur fixe (325px, le minimum accepté par TikTok), incompatible avec une
// grille classique.
//
// Aucun script tiers n'est chargé ici : chaque vignette construit son iframe
// `embed/v2` elle-même au clic (cf. tiktok-embed.tsx).
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
    </motion.div>
  );
}

export default TiktokEmbedRow;
