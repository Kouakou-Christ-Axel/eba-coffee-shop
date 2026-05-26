import Image from 'next/image';
import { Link } from '@heroui/react';
import { motion } from 'framer-motion';
import {
  IconBrandInstagram,
  IconBrandTiktok,
  IconBrandYoutube,
} from '@tabler/icons-react';
import type { SocialItem } from './social-items';

type SocialTileProps = {
  item: SocialItem;
  index: number;
  reduceMotion: boolean | null;
};

function SocialTile({ item, index, reduceMotion }: SocialTileProps) {
  const isInstagram = item.platform === 'Instagram';
  const PlatformIcon = isInstagram ? IconBrandInstagram : IconBrandTiktok;

  return (
    <motion.li
      initial={reduceMotion ? undefined : { opacity: 0, y: 16 }}
      whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.25 }}
      transition={
        reduceMotion
          ? undefined
          : { duration: 0.6, ease: 'easeOut', delay: index * 0.07 }
      }
    >
      <Link
        isExternal
        href={item.href}
        className="group block overflow-hidden rounded-2xl border border-default-200/75 bg-content1 shadow-sm transition duration-500 md:hover:scale-[1.015] md:hover:shadow-lg"
      >
        <figure className="relative">
          <div className="relative aspect-4/5 w-full overflow-hidden">
            <Image
              src={item.imageSrc}
              alt={item.imageAlt}
              fill
              sizes="(max-width: 768px) 50vw, 33vw"
              className="object-cover transition-transform duration-500 ease-out md:group-hover:scale-[1.03]"
            />
          </div>

          <figcaption className="absolute left-3 right-3 top-3 flex items-center justify-between">
            <span className="inline-flex items-center gap-1 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur-sm">
              <PlatformIcon aria-hidden="true" className="h-3.5 w-3.5" />
              {item.platform}
            </span>
            {item.type === 'video' && (
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm">
                <IconBrandYoutube aria-hidden="true" className="h-3.5 w-3.5" />
              </span>
            )}
          </figcaption>

          <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/65 via-black/25 to-transparent p-3">
            <p className="text-xs font-medium text-white sm:text-sm">
              {item.title}
            </p>
          </div>
        </figure>
      </Link>
    </motion.li>
  );
}

export default SocialTile;
