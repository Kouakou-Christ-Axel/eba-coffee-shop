import type { ContactSettings } from '@/lib/contact-settings';
import SocialTile from './social-tile';
import { buildSocialItems } from './social-items';

type SocialGalleryProps = {
  reduceMotion: boolean | null;
  contact: ContactSettings;
};

function SocialGallery({ reduceMotion, contact }: SocialGalleryProps) {
  const socialItems = buildSocialItems(contact);
  return (
    <ul
      className="mt-8 grid grid-cols-2 gap-4 md:mt-10 md:grid-cols-3 md:gap-5"
      role="list"
    >
      {socialItems.map((item, index) => (
        <SocialTile
          key={`${item.title}-${index}`}
          item={item}
          index={index}
          reduceMotion={reduceMotion}
        />
      ))}
    </ul>
  );
}

export default SocialGallery;
