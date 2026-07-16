import type { ContactSettings } from '@/lib/contact-settings';

export type SocialItem = {
  title: string;
  platform: 'Instagram' | 'TikTok';
  type: 'image' | 'video';
  href: string;
  imageSrc: string;
  imageAlt: string;
};

export function buildSocialItems(contact: ContactSettings): SocialItem[] {
  const instagramLink = contact.instagramUrl;
  const tiktokLink = contact.tiktokUrl;

  return [
    {
      title: 'Latte art du matin',
      platform: 'Instagram',
      type: 'image',
      href: instagramLink,
      imageSrc: '/assets/examples/accueil/eba-hero-2.png',
      imageAlt: 'Cafe signature servi sur un comptoir elegant a Abidjan',
    },
    {
      title: 'Backstage patisserie',
      platform: 'TikTok',
      type: 'video',
      href: tiktokLink,
      imageSrc: '/assets/examples/accueil/eba-hero.webp',
      imageAlt: 'Preparation de patisserie artisanale dans l ambiance EBA',
    },
    {
      title: 'Ambiance du lieu',
      platform: 'Instagram',
      type: 'image',
      href: instagramLink,
      imageSrc: '/assets/examples/accueil/eba-hero.webp',
      imageAlt: 'Ambiance chaleureuse du coffee shop EBA a Abidjan',
    },
    {
      title: 'Routine barista',
      platform: 'TikTok',
      type: 'video',
      href: tiktokLink,
      imageSrc: '/assets/examples/accueil/eba-hero-2.png',
      imageAlt: 'Barista en preparation de cafe dans un decor premium',
    },
    {
      title: 'Pause gourmande',
      platform: 'Instagram',
      type: 'image',
      href: instagramLink,
      imageSrc: '/assets/examples/accueil/eba-hero-2.png',
      imageAlt: 'Patisserie et cafe servis en salle dans le quartier Cocody',
    },
    {
      title: 'Vibes du soir',
      platform: 'TikTok',
      type: 'video',
      href: tiktokLink,
      imageSrc: '/assets/examples/accueil/eba-hero.webp',
      imageAlt: 'Scene video de l ambiance du lieu EBA en fin de journee',
    },
  ];
}
