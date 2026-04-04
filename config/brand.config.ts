export const brandConfig = {
  name: 'EBA',
  menu: [
    {
      label: 'Accueil',
      href: '/',
    },
    {
      label: 'À propos',
      href: '/a-propos',
    },
    {
      label: 'Carte',
      href: '/carte',
    },
    {
      label: 'Le lieu',
      href: '/le-lieu',
    },
    {
      label: 'Contact',
      href: '/contact',
    },
  ],
  links: {
    social: {
      instagram: {
        label: 'Instagram',
        handle: '@eba.coffeeshop',
        href: 'https://www.instagram.com/eba.coffeeshop/',
      },
      tiktok: {
        label: 'TikTok',
        handle: '@eba.coffeeshop',
        href: 'https://www.tiktok.com/@eba.coffeeshop',
      },
    },
    contact: {
      address: 'Boulevard Latrille, Cocody, Abidjan',
      landmark: 'A 2 min du carrefour Duncan',
      hours: 'Lun - Dim : 7h30 - 21h30',
      whatsapp: {
        label: 'WhatsApp',
        display: '+225 07 00 00 00 00',
        href: 'https://wa.me/2250700000000',
      },
      phone: {
        label: 'Telephone',
        display: '+225 27 22 00 00 00',
        href: 'tel:+2252722000000',
      },
      email: {
        label: 'Email',
        display: 'contact@eba.ci',
        href: 'mailto:contact@eba.ci',
      },
    },
    maps: {
      directions:
        'https://maps.google.com/?q=Boulevard+Latrille+Cocody+Abidjan',
      embed:
        'https://www.google.com/maps?q=Boulevard+Latrille+Cocody+Abidjan&output=embed',
    },
    hashtag: {
      label: '#InstantEBA',
      href: 'https://www.instagram.com/explore/tags/InstantEBA/',
    },
  },
} as const;
