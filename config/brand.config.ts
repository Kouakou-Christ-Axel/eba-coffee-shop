export const brandConfig = {
  name: 'EBA',
  founderName: 'Fondatrice EBA',
  location: {
    address: 'Boulevard Latrille, Cocody, Abidjan',
    district: 'Cocody, Abidjan',
    landmark: 'A 2 min du carrefour Duncan',
    schedule: 'Lun - Dim : 7h30 - 21h30',
    openingTime: '07:30',
    closingTime: '21:30',
    phone: '+225 27 22 00 00 00',
    whatsapp: '+225 07 00 00 00 00',
    whatsappLink: 'https://wa.me/2250700000000',
    mapsLink: 'https://maps.app.goo.gl/rVWsT26ZDLaBCWhW9',
    mapsEmbed:
      'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3775.551175252953!2d-3.9601476!3d5.4037600999999995!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0xfc193623ac5095f%3A0x7f92b7dfdde03a30!2sEba%20coffee%20shop!5e1!3m2!1sfr!2sci!4v1780742729469!5m2!1sfr!2sci',
  },
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
      label: 'Sondages',
      href: '/sondages',
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
        'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3775.551175252953!2d-3.9601476!3d5.4037600999999995!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0xfc193623ac5095f%3A0x7f92b7dfdde03a30!2sEba%20coffee%20shop!5e1!3m2!1sfr!2sci!4v1780742729469!5m2!1sfr!2sci',
    },
    hashtag: {
      label: '#InstantEBA',
      href: 'https://www.instagram.com/explore/tags/InstantEBA/',
    },
  },
} as const;
