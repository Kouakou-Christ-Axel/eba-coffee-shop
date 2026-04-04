# Contact Page Redesign — EBA Coffee Shop

## Problem

The current contact page has 5 disconnected sections with gross separations between them. GSAP animations break responsive layout even on large screens. The page feels like a generic template and doesn't match the quality of the homepage.

## Solution

Redesign with 3 interconnected sections using the "overlapping elements" approach. Eliminate all hard separations. Replace GSAP entirely with Framer Motion (consistent with homepage patterns).

## Architecture

### Files

| File                                                           | Action      | Purpose                               |
| -------------------------------------------------------------- | ----------- | ------------------------------------- |
| `app/(public)/contact/page.tsx`                                | **Edit**    | Update to use 3 sections instead of 5 |
| `components/(public)/contact/contact-hero-section.tsx`         | **Rewrite** | Hero + overlapping contact cards      |
| `components/(public)/contact/contact-form-section.tsx`         | **Rewrite** | Full-width form with 2-col grid       |
| `components/(public)/contact/contact-map-section.tsx`          | **Rewrite** | Full-width map with info overlay      |
| `components/(public)/contact/contact-quick-access-section.tsx` | **Delete**  | Content absorbed into hero cards      |
| `components/(public)/contact/contact-cta-section.tsx`          | **Delete**  | WhatsApp CTA absorbed into hero cards |

### Dependencies

- `framer-motion` (already installed)
- `lucide-react` icons: `MessageCircle`, `Phone`, `MapPin`, `Clock3`, `Send`
- HeroUI components: `Input`, `Select`, `SelectItem`, `Textarea`, `Button`, `Link`, `Card`, `CardBody`
- `next/image` for hero background

No new dependencies needed.

---

## Section 1 — Hero Compact + Contact Cards

### Layout

- `<section>` with `relative min-h-[50vh]` (not full-screen)
- Background: `next/image` with `fill`, `object-cover`, `priority`
- Overlay: `bg-black/50`
- Content centered vertically and horizontally

### Content

- Badge pill: "Contact" — styled like homepage (`rounded-full border border-white/40 bg-white/10 px-4 py-1 text-xs uppercase tracking-[0.2em]`)
- h1: "Parlons autour d'un cafe" — `text-balance text-3xl font-bold sm:text-4xl md:text-5xl` white
- Subtitle: "On vous repond en moins d'une heure sur WhatsApp" — `text-white/80`

### Overlapping Contact Cards

- Container: `relative z-10 -mb-16 mx-auto max-w-3xl px-6` positioned at the bottom of the hero, extending below it via negative margin
- 3 cards in a `grid grid-cols-1 sm:grid-cols-3 gap-4`
- Each card: `bg-white rounded-xl shadow-md p-6 text-center`
  - Icon circle: `w-12 h-12 rounded-full bg-primary/10 mx-auto flex items-center justify-center` with Lucide icon in `text-primary`
  - Label: font-semibold (e.g., "WhatsApp")
  - Value: text-sm text-foreground/70 (e.g., "+225 07 00 00 00 00")
  - Entire card is a clickable link (`<a>` wrapping the card content)

| Card      | Icon            | Color     | Label        | Value                 | Link                          |
| --------- | --------------- | --------- | ------------ | --------------------- | ----------------------------- |
| WhatsApp  | `MessageCircle` | primary   | WhatsApp     | +225 07 00 00 00 00   | `https://wa.me/2250700000000` |
| Telephone | `Phone`         | secondary | Telephone    | +225 27 22 00 00 00   | `tel:+22527220000000`         |
| Adresse   | `MapPin`        | primary   | Nous trouver | Blvd Latrille, Cocody | Google Maps link              |

### Animation

- Framer Motion, `useReducedMotion()` respected
- Hero content: fade-up `{ opacity: 0, y: 20 }` → `{ opacity: 1, y: 0 }`, duration 0.6s
- Cards: staggered fade-up, 0.08s delay per card, triggered `whileInView` with `once: true`

### Responsive

- Cards stack vertically on mobile (`grid-cols-1`), 3 columns on `sm:` and up
- Hero text sizes scale: `text-3xl` → `sm:text-4xl` → `md:text-5xl`

---

## Section 2 — Contact Form

### Layout

- `<section>` with `pt-24 pb-14 md:pb-20` (extra top padding to accommodate overlapping cards from above)
- Background: `bg-[linear-gradient(180deg,rgba(255,252,248,1)_0%,rgba(250,246,242,1)_100%)]` (same gradient as homepage FindUs section — seamless visual flow)
- Content inside `content-container px-6`, max-width centered

### Content

- Section title: "Envoyez-nous un message" — `text-2xl font-bold sm:text-3xl`
- Subtitle: "Pour une reservation, un partenariat ou une question" — `text-foreground/70`
- Form with `<form>` element, grid layout

### Form Fields

- Row 1: `grid grid-cols-1 sm:grid-cols-2 gap-4`
  - Nom complet (`Input`, required)
  - Email (`Input`, type="email", required)
- Row 2: `grid grid-cols-1 sm:grid-cols-2 gap-4`
  - Telephone (`Input`, type="tel")
  - Motif (`Select` with `SelectItem`): "Question generale", "Reservation", "Partenariat"
- Row 3: Message (`Textarea`, required, 4 rows)
- Submit: `Button` color="primary" radius="full" size="lg" with `Send` icon as endContent

All inputs use HeroUI components with `variant="bordered"` and `radius="lg"` for consistency.

### Animation

- Framer Motion staggered fade-up on form fields
- Parent container with `staggerChildren: 0.06`
- Each row: `{ opacity: 0, y: 16 }` → `{ opacity: 1, y: 0 }`
- `viewport: { once: true, amount: 0.3 }`

### Responsive

- 2-column grid collapses to 1 column on mobile
- Submit button full-width on mobile, auto-width on desktop

---

## Section 3 — Map + Info Overlay

### Layout

- `<section>` with `relative` positioning
- No vertical padding — map goes edge-to-edge visually
- Map container: `relative w-full h-80 md:h-[28rem]`

### Content

- Google Maps iframe: `w-full h-full border-0`, same src as current (`Boulevard+Latrille+Cocody+Abidjan`)
- `loading="lazy"`, `referrerPolicy="no-referrer-when-downgrade"`

### Info Overlay Card

- Position: `absolute bottom-4 left-4 md:bottom-6 md:left-6`
- Style: `bg-white rounded-xl shadow-lg p-4 md:p-5 max-w-xs`
- Content:
  - Horaires: `Clock3` icon + "Lun - Dim : 7h30 - 21h30" — `text-sm font-medium`
  - Repere: `MapPin` icon + "A 2 min du carrefour Duncan" — `text-sm text-foreground/70`
  - Button: "Voir l'itineraire" — `Button` variant="bordered" color="secondary" radius="full" size="sm", links to Google Maps

### Animation

- Framer Motion fade-in on the overlay card
- `{ opacity: 0, y: 12 }` → `{ opacity: 1, y: 0 }`, duration 0.6s, delay 0.3s
- `viewport: { once: true }`

### Responsive

- Map height: `h-80` on mobile, `h-[28rem]` on desktop
- Overlay card: smaller padding on mobile (`p-4`), larger on desktop (`p-5`)
- Card stays bottom-left with safe margins

---

## Page Composition

```tsx
// app/(public)/contact/page.tsx
import ContactHeroSection from '@/components/(public)/contact/contact-hero-section';
import ContactFormSection from '@/components/(public)/contact/contact-form-section';
import ContactMapSection from '@/components/(public)/contact/contact-map-section';

export const metadata = {
  /* existing SEO metadata */
};

export default function ContactPage() {
  return (
    <>
      <ContactHeroSection />
      <ContactFormSection />
      <ContactMapSection />
    </>
  );
}
```

---

## Animation Guidelines

- **Framer Motion only** — no GSAP, no SplitText, no ScrollTrigger
- `useReducedMotion()` hook checked in every client component
- When `reduceMotion` is true, pass empty objects `{}` for all motion props
- Easing: `'easeOut'` for simple fades, `[0.22, 1, 0.36, 1]` for smoother curves
- Durations: 0.45s-0.65s range, never above 0.8s
- `viewport: { once: true, amount: 0.25-0.4 }` for scroll triggers
- Stagger: 0.06-0.08s between sibling elements

## Accessibility

- `aria-labelledby` on each section linked to its heading
- `sr-only` labels where visual context is sufficient
- `aria-hidden="true"` on decorative icons
- `rel="noopener noreferrer"` on external links
- Form labels visible (not placeholder-only)
- Required fields marked
- Semantic HTML: `<address>`, `<form>`, `<section>`

## Image

- Hero image: `/assets/examples/accueil/eba-hero.webp` (reused from current contact hero — no dedicated contact assets exist)
- `next/image` with `fill`, `priority`, `object-cover`
