# Page Contact — Design Spec

## Objectif

Page de contact avancee pour EBA Coffee Shop avec animations GSAP immersives. La page sert 3 objectifs : contact rapide (WhatsApp/tel), formulaire de contact avec motifs, et localisation du lieu.

## Structure de la page

### Section 1 — Hero (plein ecran)

- **Layout** : image plein ecran (`min-h-svh`) + overlay sombre (`bg-black/50`)
- **Image** : `/assets/examples/accueil/eba-hero.webp` (reutilise l'existant)
- **Contenu centre** :
  - Titre H1 : "Parlons autour d'un cafe"
  - Sous-titre : "Une question, une reservation ou un projet ? On vous repond avec plaisir."
- **Animations GSAP** :
  - Image : leger zoom-out au chargement (`scale: 1.08 -> 1`, duree 1.6s)
  - Titre : SplitText mot par mot, chaque mot fade + translateY (stagger 0.08s)
  - Sous-titre : fade-in apres le titre (delay 0.6s)

### Section 2 — Acces rapide (split 2 colonnes)

- **Layout** : `grid lg:grid-cols-2`, fond avec gradient creme (comme `FindUsSection`)
- **Colonne gauche** — 3 cartes empilees :
  - **WhatsApp** : icone `MessageCircle`, "+225 07 00 00 00 00", bouton "Ecrire sur WhatsApp" → lien `wa.me/2250700000000`
  - **Telephone** : icone `Phone`, "+225 27 22 00 00 00", bouton "Appeler" → lien `tel:`
  - **Itineraire** : icone `MapPin`, "Boulevard Latrille, Cocody", bouton "Voir l'itineraire" → Google Maps
  - Style : cards HeroUI avec `border border-default-200/70 bg-content1/90`, icones en `text-primary`
- **Colonne droite** — image du lieu dans une Card arrondie (comme `UniversEbaSection`)
- **Animations GSAP** :
  - Cartes : stagger depuis la gauche (`x: -30 -> 0, opacity: 0 -> 1`, stagger 0.12s)
  - Image : fade-in depuis la droite (`x: 30 -> 0, opacity: 0 -> 1`)
  - Declenchement : ScrollTrigger `top: 80% bottom`

### Section 3 — Formulaire (split inverse)

- **Layout** : `grid lg:grid-cols-2`, fond `bg-muted/35`
- **Colonne gauche** — image ambiance (Card arrondie, `shadow-xl`)
- **Colonne droite** — formulaire :
  - **Champs** (composants HeroUI) :
    - `Select` — Motif : "Question generale", "Partenariat", "Reservation"
    - `Input` — Nom complet
    - `Input` — Email
    - `Input` — Telephone
    - `Textarea` — Message
    - `Button` — "Envoyer le message" (color primary, radius full)
  - Le formulaire est cote client (`'use client'`) avec state local pour les valeurs
  - Pas de backend pour l'instant (action du formulaire a implementer plus tard)
- **Animations GSAP** :
  - Image gauche : fade-in (`opacity: 0 -> 1`, duree 0.8s)
  - Champs du formulaire : stagger vertical (`y: 20 -> 0, opacity: 0 -> 1`, stagger 0.08s)
  - Bouton : scale-in a la fin (`scale: 0.9 -> 1, opacity: 0 -> 1`)
  - Declenchement : ScrollTrigger `top: 80% bottom`

### Section 4 — Carte & infos (pleine largeur)

- **Layout** : position relative, hauteur ~400px (md:h-96)
- **Fond** : iframe Google Maps pleine largeur
  - `src` : `https://www.google.com/maps?q=Boulevard+Latrille+Cocody+Abidjan&output=embed`
  - `loading="lazy"`
- **Overlay** : Card positionnee en bas a gauche (`absolute bottom-6 left-6`) :
  - Adresse : "Boulevard Latrille, Cocody, Abidjan"
  - Repere : "A 2 min du carrefour Duncan"
  - Horaires : "Lun - Dim : 7h30 - 21h30"
  - Style : `bg-content1/95 backdrop-blur-md`, bordure subtile, shadow-lg
- **Animations GSAP** :
  - iframe : fade-in au scroll
  - Card overlay : slide-up (`y: 30 -> 0, opacity: 0 -> 1`, delay 0.3s)

### Section 5 — CTA WhatsApp (banniere)

- **Layout** : pleine largeur, padding genereux, fond `bg-primary` (deep purple)
- **Contenu centre** :
  - Titre : "Envie de commander ?" (text-white)
  - Sous-titre : "Passez votre commande directement sur WhatsApp" (text-white/80)
  - Bouton : "Commander sur WhatsApp" (color secondary/gold, radius full, startContent: icone MessageCircle)
- **Animations GSAP** :
  - Bloc entier : fade-in + scale subtil (`scale: 0.95 -> 1, opacity: 0 -> 1`)
  - Declenchement : ScrollTrigger `top: 85% bottom`

## Architecture des fichiers

```
app/(public)/contact/page.tsx              — Page serveur, compose les sections
components/(public)/contact/
  contact-hero-section.tsx                 — Hero avec SplitText GSAP ('use client')
  contact-quick-access-section.tsx         — Cartes acces rapide ('use client')
  contact-form-section.tsx                 — Formulaire avec animations ('use client')
  contact-map-section.tsx                  — Carte Maps + infos overlay ('use client')
  contact-cta-section.tsx                  — Banniere CTA WhatsApp ('use client')
```

## Choix techniques

- **GSAP** partout (pas de Framer Motion) via `useGSAP` hook pour le cleanup automatique
- **ScrollTrigger** pour toutes les animations au scroll (plugin enregistre une seule fois)
- **SplitText** pour le titre du hero (plugin GSAP)
- **useReducedMotion** : detecter `prefers-reduced-motion` et desactiver les animations si active (via `gsap.matchMedia()`)
- **Composants HeroUI** : Input, Select, Textarea, Button, Card, CardBody, Link
- **Icones** : lucide-react (MessageCircle, Phone, MapPin, Clock3, Mail, Send)
- **content-container** : classe existante pour le max-width responsive

## Metadata SEO

```ts
export const metadata: Metadata = {
  title: 'Contact | EBA Coffee Shop',
  description:
    'Contactez EBA Coffee Shop a Abidjan. Reservation, question ou partenariat — ecrivez-nous ou passez nous voir a Cocody.',
};
```

## Hors scope

- Backend du formulaire (envoi d'email, stockage en base)
- Validation avancee des champs (au-dela du `required` HTML)
- Dark mode (a traiter globalement plus tard)
