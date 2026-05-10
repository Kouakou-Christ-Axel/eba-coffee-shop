# Click & Collect — Design Spec

**Date :** 2026-05-10
**Stack :** Next.js 16 App Router, React 19, Tailwind CSS v4, HeroUI, Prisma + PostgreSQL, Better Auth, Resend, Vercel Blob, Zustand, Bun

---

## Vue d'ensemble

Ajouter le click & collect au site EBA Coffee Shop. Le client commande depuis le panier existant, choisit un créneau de retrait, laisse son prénom et téléphone, et obtient une confirmation avec numéro de commande. Le propriétaire reçoit un email via Resend. Un dashboard protégé (Better Auth, admin seulement) permet de gérer les commandes et le menu (CRUD produits + images).

**Décisions clés :**

- Paiement : sur place au retrait (pas d'intégration paiement)
- Auth client : invité — prénom + téléphone, pas de compte requis
- Notification propriétaire : email via Resend (`OWNER_EMAIL`)
- Auth dashboard : Better Auth, rôle `ADMIN`
- Images produits : Vercel Blob
- WhatsApp : remplacé par le formulaire de retrait (pas d'API WhatsApp Business car entreprise non déclarée en CI)

**Approche TDD :** écrire les tests avant chaque implémentation. Chaque fonctionnalité liste ses tests en premier.

---

## Statut des fonctionnalités

| #   | Fonctionnalité                       | Statut     |
| --- | ------------------------------------ | ---------- |
| 1   | Schéma & persistance commandes       | ⬜ À faire |
| 2   | Formulaire de retrait                | ⬜ À faire |
| 3   | Page de confirmation                 | ⬜ À faire |
| 4   | Email de notification (Resend)       | ⬜ À faire |
| 5   | Dashboard — Auth admin               | ⬜ À faire |
| 6   | Dashboard — Gestion des commandes    | ⬜ À faire |
| 7   | Migration menu en base               | ⬜ À faire |
| 8   | Dashboard — Gestion du menu + images | ⬜ À faire |

> Mettre à jour le statut : ⬜ À faire → 🔄 En cours → ✅ Terminé

---

## Fonctionnalité 1 — Schéma & persistance commandes

### Spec

**Modèle Prisma `Order` :**

```prisma
enum OrderStatus {
  PENDING
  CONFIRMED
  READY
  PICKED_UP
  CANCELLED
}

model Order {
  id            String      @id @default(cuid())
  reference     String      @unique  // ex: EBA-20260510-A3F2
  customerName  String
  customerPhone String
  pickupTime    DateTime
  items         Json        // CartItem[] sérialisé (snapshot au moment de la commande)
  total         Int         // en FCFA
  status        OrderStatus @default(PENDING)
  note          String?
  createdAt     DateTime    @default(now())
  updatedAt     DateTime    @updatedAt

  @@map("order")
}
```

**Routes API :**

- `POST /api/commandes` — valide le body (Zod), crée l'Order en DB, retourne `{ id, reference }`
- `GET /api/commandes/[id]` — retourne une commande (public, pour la page de confirmation)

**Schéma de validation Zod :**

```ts
const createOrderSchema = z.object({
  customerName: z.string().min(2).max(50),
  customerPhone: z.string().min(8).max(20),
  pickupTime: z.string().datetime(),
  items: z.array(cartItemSchema).min(1),
  total: z.number().int().positive(),
});
```

**Format de référence :** `EBA-YYYYMMDD-XXXX` (4 caractères alphanumériques majuscules aléatoires). Vérifier l'unicité avant insertion.

**Fichiers à créer/modifier :**

- `prisma/schema.prisma` — ajouter enum + model
- `app/api/commandes/route.ts` — POST
- `app/api/commandes/[id]/route.ts` — GET

### TDD — Tests à écrire d'abord

- [ ] `POST /api/commandes` avec body valide → 201 + `{ id, reference }`
- [ ] `POST /api/commandes` avec items vide → 400
- [ ] `POST /api/commandes` avec téléphone trop court → 400
- [ ] `POST /api/commandes` avec total négatif → 400
- [ ] `POST /api/commandes` avec pickupTime invalide → 400
- [ ] `GET /api/commandes/[id]` avec id existant → 200 + commande
- [ ] `GET /api/commandes/[id]` avec id inexistant → 404
- [ ] La référence générée suit le format `EBA-YYYYMMDD-[A-Z0-9]{4}`
- [ ] Le statut initial est toujours `PENDING`

---

## Fonctionnalité 2 — Formulaire de retrait

### Spec

Remplacer le bouton "Commander via WhatsApp" dans `cart-drawer.tsx` par un formulaire en 2 étapes intégré au CartDrawer.

**Étape 1 (déjà existante) :** récapitulatif du panier + bouton "Passer la commande"
**Étape 2 :** formulaire de retrait

**Champs du formulaire :**

- Prénom (texte, requis, min 2 chars)
- Téléphone (texte, requis, min 8 chars — format CI : 07/05/01/XX ou +225…)
- Créneau horaire (liste de boutons sélectionnables)

**Logique des créneaux (côté client) :**

- Plage horaire : 08h00–20h00
- Intervalle : 15 minutes
- Délai minimum : 30 minutes à partir de maintenant
- Jours proposés : aujourd'hui + demain
- Format affiché : "Aujourd'hui · 14h30", "Demain · 09h00"

**Flux complet :**

1. CartDrawer step 1 → bouton "Passer la commande"
2. Step 2 s'affiche avec le formulaire
3. Submit → `POST /api/commandes`
4. Succès → fermer le drawer, vider le panier Zustand, `router.push('/commande/[id]')`
5. Erreur → afficher un message d'erreur inline

**Fichiers à modifier/créer :**

- `components/(public)/carte/cart-drawer.tsx` — remplacer le bouton WhatsApp, ajouter step 2
- `lib/pickup-slots.ts` — fonction utilitaire `generatePickupSlots(now: Date): Date[]`

### TDD — Tests à écrire d'abord

- [ ] `generatePickupSlots` retourne des créneaux dans la plage 08h00–20h00
- [ ] `generatePickupSlots` ne retourne pas de créneaux < 30 min dans le futur
- [ ] `generatePickupSlots` retourne des créneaux à intervalles de 15 min
- [ ] Le formulaire est invalide si prénom vide
- [ ] Le formulaire est invalide si téléphone vide
- [ ] Le formulaire est invalide si aucun créneau sélectionné
- [ ] Après soumission réussie, le panier Zustand est vidé (`items === []`)
- [ ] Après soumission réussie, redirection vers `/commande/[id]`
- [ ] Une erreur 400/500 affiche un message d'erreur dans le formulaire

---

## Fonctionnalité 3 — Page de confirmation

### Spec

**Route :** `app/(public)/commande/[id]/page.tsx`

**Comportement :**

- Server Component, requête Prisma directe (pas de fetch intermédiaire)
- Si `id` inexistant → `notFound()`

**Contenu affiché :**

- Icône succès (check vert)
- Titre : "Commande confirmée !"
- Référence bien visible et copiable : `EBA-YYYYMMDD-XXXX`
- Prénom du client + heure de retrait formatée
- Récapitulatif des articles (nom + suppléments + quantité + prix)
- Total
- Message : "Présentez-vous au comptoir EBA Coffee Shop à l'heure choisie. Paiement sur place en espèces ou mobile money."
- Bouton retour vers `/carte`

**Metadata :**

```ts
title: 'Commande confirmée — EBA Coffee Shop'
robots: { index: false, follow: false }
```

**Fichiers à créer :**

- `app/(public)/commande/[id]/page.tsx`

### TDD — Tests à écrire d'abord

- [ ] La page affiche la référence correcte pour un id valide
- [ ] La page affiche le prénom et le téléphone du client
- [ ] La page affiche l'heure de retrait formatée (ex: "Samedi 10 mai · 14h30")
- [ ] La page affiche la liste des articles avec suppléments
- [ ] La page affiche le total formaté en FCFA
- [ ] La page retourne 404 pour un id inexistant
- [ ] La page a le meta robots `noindex`

---

## Fonctionnalité 4 — Email de notification (Resend)

### Spec

**Déclenchement :** dans `POST /api/commandes`, après création en DB, envoi async (non bloquant).

**Destinataire :** `process.env.OWNER_EMAIL`

**Template (React Email) :**

- Sujet : `🛎️ Nouvelle commande EBA — Réf. {reference}`
- Corps :
  - Référence + heure de retrait
  - Prénom + téléphone client
  - Liste des articles (nom, suppléments, qté, prix)
  - Total
  - Lien vers `/dashboard/commandes/{id}`

**Gestion d'erreur :** si Resend échoue, logger l'erreur mais **ne pas rejeter la requête** — la commande reste créée.

**Variables d'environnement requises :**

- `RESEND_API_KEY`
- `OWNER_EMAIL`
- `NEXT_PUBLIC_APP_URL` (pour le lien dashboard)

**Fichiers à créer :**

- `lib/email.ts` — fonction `sendNewOrderEmail(order: Order): Promise<void>`
- `emails/new-order.tsx` — template React Email

### TDD — Tests à écrire d'abord

- [ ] `sendNewOrderEmail` appelle Resend avec le bon destinataire (`OWNER_EMAIL`)
- [ ] L'email contient la référence de commande
- [ ] L'email contient le prénom et le téléphone du client
- [ ] L'email contient l'heure de retrait
- [ ] L'email contient la liste des articles et le total
- [ ] Si Resend échoue, `sendNewOrderEmail` rejette la promesse (le caller gère l'erreur)
- [ ] Si `OWNER_EMAIL` est absent, la fonction log un warning et retourne sans appeler Resend
- [ ] L'échec de l'envoi email ne cause pas un 500 sur `POST /api/commandes`

---

## Fonctionnalité 5 — Dashboard — Auth admin

### Spec

**Rôle admin :** ajouter un champ `role` sur le modèle `User` Prisma.

```prisma
enum UserRole {
  USER
  ADMIN
}

// Dans model User :
role UserRole @default(USER)
```

**Désignation admin :** via env var `ADMIN_EMAIL`. Au moment du login Google, si l'email correspond → rôle `ADMIN` attribué automatiquement (hook Better Auth `onSignIn`).

**Route group :** `app/(dashboard)/`

**Layout :** `app/(dashboard)/layout.tsx`

- Vérifie la session Better Auth côté serveur
- Si non authentifié → `redirect('/login')`
- Si authentifié mais rôle `USER` → `redirect('/')`
- Affiche la sidebar : liens "Commandes" + "Menu"

**Page login :** `app/(public)/login/page.tsx`

- Bouton "Se connecter avec Google" (Better Auth client)
- Après auth → redirect vers `/dashboard`
- Accessible uniquement si non connecté (si déjà connecté → redirect `/dashboard`)

**Fichiers à créer/modifier :**

- `prisma/schema.prisma` — enum `UserRole` + champ `role`
- `app/(public)/login/page.tsx`
- `app/(dashboard)/layout.tsx`
- `lib/auth.ts` — ajouter hook `onSignIn` pour la promotion admin

### TDD — Tests à écrire d'abord

- [ ] `GET /dashboard` sans session → redirect vers `/login`
- [ ] `GET /dashboard` avec session `USER` → redirect vers `/`
- [ ] `GET /dashboard` avec session `ADMIN` → 200
- [ ] `GET /login` avec session existante → redirect vers `/dashboard`
- [ ] Un user dont l'email = `ADMIN_EMAIL` obtient le rôle `ADMIN` après login
- [ ] Un user avec email différent obtient le rôle `USER`

---

## Fonctionnalité 6 — Dashboard — Gestion des commandes

### Spec

**Vue liste :** `app/(dashboard)/dashboard/commandes/page.tsx`

- Tableau des commandes, triées par `createdAt` DESC
- Colonnes : Référence | Client | Téléphone | Créneau | Nb articles | Total | Statut | Lien détail
- Tabs de filtre : Toutes / En attente / Confirmées / Prêtes / Récupérées / Annulées
- Pagination : 20 par page, Server Component avec query params `?page=N&status=X`

**Vue détail :** `app/(dashboard)/dashboard/commandes/[id]/page.tsx`

- Toutes les infos de la commande
- Détail complet des articles avec suppléments
- Boutons d'action selon statut courant :
  - `PENDING` → "Confirmer" (→ `CONFIRMED`) + "Annuler" (→ `CANCELLED`)
  - `CONFIRMED` → "Marquer comme prête" (→ `READY`) + "Annuler"
  - `READY` → "Marquer comme récupérée" (→ `PICKED_UP`)
  - `PICKED_UP` / `CANCELLED` → lecture seule
- Actions via Server Actions (pas de route API séparée)

**Fichiers à créer :**

- `app/(dashboard)/dashboard/commandes/page.tsx`
- `app/(dashboard)/dashboard/commandes/[id]/page.tsx`
- `app/(dashboard)/dashboard/commandes/actions.ts` — Server Actions `updateOrderStatus`

### TDD — Tests à écrire d'abord

- [ ] La liste affiche toutes les commandes triées par date
- [ ] Le filtre "En attente" n'affiche que les `PENDING`
- [ ] La pagination retourne max 20 résultats par page
- [ ] `updateOrderStatus(id, CONFIRMED)` avec session admin → met à jour le statut
- [ ] `updateOrderStatus` sans session admin → lève une erreur
- [ ] `updateOrderStatus` avec transition invalide (ex: PICKED_UP → PENDING) → lève une erreur
- [ ] La vue détail affiche les articles avec leurs suppléments
- [ ] Les boutons d'action correspondent au statut courant

---

## Fonctionnalité 7 — Migration menu en base

### Spec

**Nouveaux modèles Prisma :**

```prisma
model MenuCategory {
  id        String    @id @default(cuid())
  name      String
  slug      String    @unique
  sortOrder Int       @default(0)
  available Boolean   @default(true)
  products  Product[]
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt

  @@map("menu_category")
}

model Product {
  id               String            @id @default(cuid())
  name             String
  description      String
  price            Int               // en FCFA
  imageUrl         String?           // URL Vercel Blob
  available        Boolean           @default(true)
  sortOrder        Int               @default(0)
  categoryId       String
  category         MenuCategory      @relation(fields: [categoryId], references: [id], onDelete: Cascade)
  supplementGroups SupplementGroup[]
  createdAt        DateTime          @default(now())
  updatedAt        DateTime          @updatedAt

  @@map("product")
}

model SupplementGroup {
  id        String             @id @default(cuid())
  name      String
  type      String             // 'single' | 'multiple'
  required  Boolean            @default(false)
  sortOrder Int                @default(0)
  productId String
  product   Product            @relation(fields: [productId], references: [id], onDelete: Cascade)
  options   SupplementOption[]

  @@map("supplement_group")
}

model SupplementOption {
  id      String          @id @default(cuid())
  name    String
  price   Int             // en FCFA, 0 = inclus
  groupId String
  group   SupplementGroup @relation(fields: [groupId], references: [id], onDelete: Cascade)

  @@map("supplement_option")
}
```

**Route API :** `GET /api/menu` — retourne les catégories disponibles avec leurs produits disponibles et suppléments. Résultat mis en cache (Next.js `revalidate`).

**Script de seed :** `prisma/seed.ts` — lit `config/menu.ts` et insère toutes les données en DB. À exécuter une seule fois.

**Migration `CarteMenuSection` :** passer de `import { menu } from '@/config/menu'` à un fetch Prisma direct (Server Component), avec même structure de données.

**`config/menu.ts` :** conservé comme référence et type source jusqu'à ce que le dashboard menu soit opérationnel, puis supprimé.

**Fichiers à créer/modifier :**

- `prisma/schema.prisma` — nouveaux modèles
- `prisma/seed.ts` — seed depuis `config/menu.ts`
- `app/api/menu/route.ts` — GET
- `components/(public)/carte/carte-menu-section.tsx` — fetch depuis DB

### TDD — Tests à écrire d'abord

- [ ] `GET /api/menu` retourne les catégories avec leurs produits et suppléments
- [ ] `GET /api/menu` exclut les produits `available: false`
- [ ] `GET /api/menu` exclut les catégories `available: false`
- [ ] `GET /api/menu` trie les catégories par `sortOrder` ASC
- [ ] Le seed insère exactement le même nombre de catégories que `config/menu.ts`
- [ ] Le seed insère tous les produits avec leurs groupes et options de suppléments
- [ ] La page `/carte` affiche le même menu après migration qu'avant

---

## Fonctionnalité 8 — Dashboard — Gestion du menu + images

### Spec

**Vue catégories :** `app/(dashboard)/dashboard/menu/page.tsx`

- Liste des catégories avec drag-and-drop pour réordonner (ou boutons ▲▼)
- Toggle disponibilité par catégorie
- Bouton "Nouvelle catégorie" (modal avec champ nom)

**Vue produits par catégorie :** `app/(dashboard)/dashboard/menu/[categoryId]/page.tsx`

- Grille des produits avec image, nom, prix, statut disponible
- Bouton "Nouveau produit"
- Toggle disponibilité par produit
- Bouton Modifier / Supprimer

**Formulaire produit (page dédiée ou modal) :**

- Nom (texte, requis)
- Description (textarea, requis)
- Prix (number, FCFA, requis)
- Image (upload fichier → Vercel Blob) avec prévisualisation immédiate
- Groupes de suppléments (dynamique : ajouter/supprimer des groupes, chaque groupe avec ses options)
- Disponibilité (toggle)

**Upload d'images :**

- Route `POST /api/upload` → `@vercel/blob` `put()`, retourne `{ url }`
- Formats acceptés : JPEG, PNG, WebP
- Taille max : 5 MB
- Stockée dans `Product.imageUrl`

**Server Actions (admin only) :**

- `createCategory`, `updateCategory`, `deleteCategory`
- `createProduct`, `updateProduct`, `deleteProduct`
- `uploadProductImage` (wraps route `/api/upload`)

**Fichiers à créer :**

- `app/(dashboard)/dashboard/menu/page.tsx`
- `app/(dashboard)/dashboard/menu/[categoryId]/page.tsx`
- `app/(dashboard)/dashboard/menu/[categoryId]/product-form.tsx`
- `app/(dashboard)/dashboard/menu/actions.ts`
- `app/api/upload/route.ts`

### TDD — Tests à écrire d'abord

- [ ] `createProduct` avec body valide → produit créé en DB
- [ ] `createProduct` sans session admin → lève une erreur
- [ ] `updateProduct` met à jour uniquement les champs fournis
- [ ] `deleteProduct` supprime le produit et ses groupes de suppléments (cascade)
- [ ] `POST /api/upload` avec JPEG valide (< 5MB) → 200 + URL Vercel Blob
- [ ] `POST /api/upload` avec fichier > 5MB → 400
- [ ] `POST /api/upload` avec format non supporté (ex: PDF) → 400
- [ ] `POST /api/upload` sans session admin → 401
- [ ] Désactiver un produit le masque immédiatement sur `GET /api/menu`
- [ ] Supprimer une catégorie cascade-supprime ses produits

---

## Ordre d'implémentation

```
1 (Schéma commandes)
→ 2 (Formulaire de retrait)
→ 3 (Page de confirmation)
→ 4 (Email Resend)
→ 5 (Auth dashboard)
→ 6 (Dashboard commandes)
→ 7 (Migration menu)
→ 8 (Dashboard menu + images)
```

Les fonctionnalités 1–4 forment le flux client complet. Les fonctionnalités 5–6 forment le backoffice commandes. Les fonctionnalités 7–8 forment le backoffice menu. Chaque groupe est indépendant des suivants.

---

## Variables d'environnement à ajouter

```env
RESEND_API_KEY=
OWNER_EMAIL=
ADMIN_EMAIL=
NEXT_PUBLIC_APP_URL=
BLOB_READ_WRITE_TOKEN=   # Vercel Blob
```

---

## Dépendances à installer

```bash
bun add resend @react-email/components @react-email/render
bun add @vercel/blob
bun add zod   # si pas déjà présent
```
