# Feature 4 — Email de notification (Resend) — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Envoyer un email de notification au propriétaire via Resend à chaque nouvelle commande, sans bloquer la réponse HTTP.

**Architecture:** `POST /api/commandes` crée l'Order en DB, puis appelle `sendNewOrderEmail(order)` de façon non-bloquante (`.catch()` pour logger les erreurs sans affecter le 201). La fonction `sendNewOrderEmail` dans `lib/email.tsx` rend le template React Email (`emails/new-order.tsx`) via `renderAsync` et envoie via le SDK Resend. Si `OWNER_EMAIL` est absent, elle log un warning et retourne sans appeler Resend.

**Tech Stack:** Vitest (globals: false — tous imports explicites), Next.js 16 App Router, Resend SDK, React Email (`@react-email/components`, `@react-email/render`), vi.mock pour mocker Resend dans les tests, `renderToStaticMarkup` pour tester le template.

---

## Structure des fichiers

| Action  | Fichier                                          | Responsabilité                                           |
| ------- | ------------------------------------------------ | -------------------------------------------------------- |
| Modify  | `package.json`                                   | Ajouter resend, @react-email/components, @react-email/render |
| Modify  | `.env.schema`                                    | Déclarer RESEND_API_KEY et OWNER_EMAIL                   |
| Create  | `lib/email.tsx`                                  | `sendNewOrderEmail(order)` — wrapper Resend              |
| Create  | `lib/email.test.ts`                              | Tests unitaires de sendNewOrderEmail (Resend mocké)      |
| Create  | `emails/new-order.tsx`                           | Template React Email pour le propriétaire                |
| Create  | `emails/new-order.test.tsx`                      | Tests de contenu du template (renderToStaticMarkup)      |
| Modify  | `app/api/commandes/route.ts`                     | Appel non-bloquant de sendNewOrderEmail après createOrder |
| Modify  | `app/api/commandes/route.test.ts`                | Ajouter le test : échec email → ne cause pas un 500      |
| Modify  | `docs/superpowers/specs/2026-05-10-click-and-collect-design.md` | Marquer F4 comme Terminé            |

---

## Task 0 — Installer les dépendances + configurer l'environnement

**Files:**
- Modify: `package.json`
- Modify: `.env.schema`

- [ ] **Step 1 : Installer les packages**

```bash
bun add resend @react-email/components @react-email/render
```

Résultat attendu : les 3 packages apparaissent dans `dependencies` dans `package.json`.

- [ ] **Step 2 : Mettre à jour `.env.schema`**

Ajouter à la fin du fichier `.env.schema` :

```
# @type=string
RESEND_API_KEY=
# @type=string
OWNER_EMAIL=
```

`NEXT_PUBLIC_SITE_URL` est déjà présente dans le schema — c'est elle qui sera utilisée pour le lien dashboard dans l'email.

- [ ] **Step 3 : Commit**

```bash
rtk git add package.json bun.lock .env.schema && rtk git commit -m "chore: add resend + react-email deps and env vars for F4"
```

---

## Task 1 — TDD : `lib/email.tsx`

**Files:**
- Create: `lib/email.test.ts`
- Create: `lib/email.tsx`

- [ ] **Step 1 : Créer le fichier de test**

```ts
// lib/email.test.ts
import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  type MockedFunction,
} from 'vitest';

const mockSend = vi.fn();

vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: { send: mockSend },
  })),
}));

vi.mock('@react-email/render', () => ({
  renderAsync: vi.fn().mockResolvedValue('<html>mock email</html>'),
}));

vi.mock('@/emails/new-order', () => ({
  default: vi.fn().mockReturnValue(null),
}));

import { sendNewOrderEmail } from './email';

const mockOrder = {
  id: 'clorder123',
  reference: 'EBA-20260510-AB12',
  customerName: 'Kofi',
  customerPhone: '07001234',
  pickupTime: new Date('2026-05-10T14:30:00'),
  items: [
    {
      cartId: 'abc',
      productId: 'prod-1',
      productName: 'Cappuccino',
      basePrice: 3500,
      quantity: 1,
      supplements: [],
    },
  ],
  total: 3500,
};

describe('sendNewOrderEmail', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // renderAsync doit retourner un string après reset
    const { renderAsync } = await import('@react-email/render');
    (renderAsync as MockedFunction<typeof renderAsync>).mockResolvedValue(
      '<html>mock email</html>'
    );
  });

  it('envoie l\'email au bon destinataire (OWNER_EMAIL)', async () => {
    process.env.OWNER_EMAIL = 'owner@test.com';
    mockSend.mockResolvedValue({ data: { id: 'email-id' }, error: null });

    await sendNewOrderEmail(mockOrder);

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'owner@test.com' })
    );
  });

  it('le sujet de l\'email contient la référence de commande', async () => {
    process.env.OWNER_EMAIL = 'owner@test.com';
    mockSend.mockResolvedValue({ data: { id: 'email-id' }, error: null });

    await sendNewOrderEmail(mockOrder);

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: expect.stringContaining('EBA-20260510-AB12'),
      })
    );
  });

  it('si OWNER_EMAIL absent, log un warning et ne pas appeler Resend', async () => {
    delete process.env.OWNER_EMAIL;
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await sendNewOrderEmail(mockOrder);

    expect(mockSend).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('OWNER_EMAIL')
    );
    warnSpy.mockRestore();
  });

  it('si Resend échoue, sendNewOrderEmail rejette la promesse', async () => {
    process.env.OWNER_EMAIL = 'owner@test.com';
    mockSend.mockRejectedValue(new Error('Resend API error'));

    await expect(sendNewOrderEmail(mockOrder)).rejects.toThrow(
      'Resend API error'
    );
  });
});
```

> **Note :** Le `await import(...)` dans `beforeEach` cause une erreur de parsing dans Vitest car `beforeEach` est synchrone à la définition. Remplacer le `beforeEach` par la version ci-dessous :

```ts
describe('sendNewOrderEmail', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockSend.mockResolvedValue({ data: { id: 'email-id' }, error: null });
  });
```

Le mock de `renderAsync` est défini globalement avec `vi.mock` (hoisted), donc il reste actif après `resetAllMocks` — sauf `mockSend` qui est réinitialisé proprement dans `beforeEach`.

Voici le fichier de test complet et corrigé :

```ts
// lib/email.test.ts
import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
} from 'vitest';

const mockSend = vi.fn();

vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: { send: mockSend },
  })),
}));

vi.mock('@react-email/render', () => ({
  renderAsync: vi.fn().mockResolvedValue('<html>mock email</html>'),
}));

vi.mock('@/emails/new-order', () => ({
  default: vi.fn().mockReturnValue(null),
}));

import { sendNewOrderEmail } from './email';

const mockOrder = {
  id: 'clorder123',
  reference: 'EBA-20260510-AB12',
  customerName: 'Kofi',
  customerPhone: '07001234',
  pickupTime: new Date('2026-05-10T14:30:00'),
  items: [
    {
      cartId: 'abc',
      productId: 'prod-1',
      productName: 'Cappuccino',
      basePrice: 3500,
      quantity: 1,
      supplements: [],
    },
  ],
  total: 3500,
};

describe('sendNewOrderEmail', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockSend.mockResolvedValue({ data: { id: 'email-id' }, error: null });
  });

  it("envoie l'email au bon destinataire (OWNER_EMAIL)", async () => {
    process.env.OWNER_EMAIL = 'owner@test.com';

    await sendNewOrderEmail(mockOrder);

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'owner@test.com' })
    );
  });

  it('le sujet de l\'email contient la référence de commande', async () => {
    process.env.OWNER_EMAIL = 'owner@test.com';

    await sendNewOrderEmail(mockOrder);

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: expect.stringContaining('EBA-20260510-AB12'),
      })
    );
  });

  it('si OWNER_EMAIL absent, log un warning et ne pas appeler Resend', async () => {
    delete process.env.OWNER_EMAIL;
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await sendNewOrderEmail(mockOrder);

    expect(mockSend).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('OWNER_EMAIL')
    );
    warnSpy.mockRestore();
  });

  it('si Resend échoue, sendNewOrderEmail rejette la promesse', async () => {
    process.env.OWNER_EMAIL = 'owner@test.com';
    mockSend.mockRejectedValue(new Error('Resend API error'));

    await expect(sendNewOrderEmail(mockOrder)).rejects.toThrow(
      'Resend API error'
    );
  });
});
```

- [ ] **Step 2 : Lancer les tests (ils doivent échouer)**

```bash
rtk vitest run lib/email.test.ts
```

Résultat attendu : `Cannot find module './email'`

- [ ] **Step 3 : Créer `lib/email.tsx`**

```tsx
// lib/email.tsx
import React from 'react';
import { Resend } from 'resend';
import { renderAsync } from '@react-email/render';
import NewOrderEmail from '@/emails/new-order';
import type { CartItem } from '@/lib/cart-store';

type OrderData = {
  id: string;
  reference: string;
  customerName: string;
  customerPhone: string;
  pickupTime: Date;
  items: unknown;
  total: number;
};

export async function sendNewOrderEmail(order: OrderData): Promise<void> {
  const ownerEmail = process.env.OWNER_EMAIL;
  if (!ownerEmail) {
    console.warn('[email] OWNER_EMAIL non défini — notification ignorée');
    return;
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const html = await renderAsync(
    React.createElement(NewOrderEmail, { order })
  );

  await resend.emails.send({
    from: 'EBA Coffee Shop <noreply@ebacoffeeshop.ci>',
    to: ownerEmail,
    subject: `🛎️ Nouvelle commande EBA — Réf. ${order.reference}`,
    html,
  });
}
```

- [ ] **Step 4 : Lancer les tests (ils doivent passer)**

```bash
rtk vitest run lib/email.test.ts
```

Résultat attendu :

```
✓ lib/email.test.ts (4)
  ✓ sendNewOrderEmail > envoie l'email au bon destinataire (OWNER_EMAIL)
  ✓ sendNewOrderEmail > le sujet de l'email contient la référence de commande
  ✓ sendNewOrderEmail > si OWNER_EMAIL absent, log un warning et ne pas appeler Resend
  ✓ sendNewOrderEmail > si Resend échoue, sendNewOrderEmail rejette la promesse

Test Files  1 passed (1)
Tests       4 passed (4)
```

- [ ] **Step 5 : Commit**

```bash
rtk git add lib/email.tsx lib/email.test.ts && rtk git commit -m "feat: add sendNewOrderEmail with TDD"
```

---

## Task 2 — TDD : `emails/new-order.tsx`

**Files:**
- Create: `emails/new-order.test.tsx`
- Create: `emails/new-order.tsx`

- [ ] **Step 1 : Créer le fichier de test**

```tsx
// emails/new-order.test.tsx
import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import NewOrderEmail from './new-order';

const mockOrder = {
  id: 'clorder123',
  reference: 'EBA-20260510-AB12',
  customerName: 'Kofi',
  customerPhone: '07001234',
  pickupTime: new Date('2026-05-10T14:30:00'),
  items: [
    {
      cartId: 'abc',
      productId: 'prod-1',
      productName: 'Cappuccino',
      basePrice: 3500,
      quantity: 2,
      supplements: [
        { groupName: 'Lait', optionName: 'Lait de soja', price: 500 },
      ],
    },
  ],
  total: 8000,
};

describe('NewOrderEmail', () => {
  it('contient la référence de commande', () => {
    const html = renderToStaticMarkup(<NewOrderEmail order={mockOrder} />);
    expect(html).toContain('EBA-20260510-AB12');
  });

  it('contient le prénom du client', () => {
    const html = renderToStaticMarkup(<NewOrderEmail order={mockOrder} />);
    expect(html).toContain('Kofi');
  });

  it('contient le téléphone du client', () => {
    const html = renderToStaticMarkup(<NewOrderEmail order={mockOrder} />);
    expect(html).toContain('07001234');
  });

  it("contient l'heure de retrait (HHhMM)", () => {
    const html = renderToStaticMarkup(<NewOrderEmail order={mockOrder} />);
    expect(html).toContain('14h30');
  });

  it('contient le nom des articles', () => {
    const html = renderToStaticMarkup(<NewOrderEmail order={mockOrder} />);
    expect(html).toContain('Cappuccino');
  });

  it('contient le nom des suppléments', () => {
    const html = renderToStaticMarkup(<NewOrderEmail order={mockOrder} />);
    expect(html).toContain('Lait de soja');
  });

  it('contient le total en FCFA', () => {
    const html = renderToStaticMarkup(<NewOrderEmail order={mockOrder} />);
    expect(html).toContain('FCFA');
    // Intl.NumberFormat('fr-FR').format(8000) → "8 000" (espace fine ou insécable)
    expect(html).toMatch(/8.000/);
  });

  it('contient un lien vers le dashboard', () => {
    const html = renderToStaticMarkup(<NewOrderEmail order={mockOrder} />);
    expect(html).toContain('/dashboard/commandes/clorder123');
  });
});
```

- [ ] **Step 2 : Lancer les tests (ils doivent échouer)**

```bash
rtk vitest run "emails/new-order.test.tsx"
```

Résultat attendu : `Cannot find module './new-order'`

- [ ] **Step 3 : Créer `emails/new-order.tsx`**

```tsx
// emails/new-order.tsx
import * as React from 'react';
import {
  Html,
  Body,
  Container,
  Heading,
  Text,
  Link,
  Hr,
} from '@react-email/components';
import { formatPickupTime } from '@/lib/format-order';
import type { CartItem } from '@/lib/cart-store';

type OrderData = {
  id: string;
  reference: string;
  customerName: string;
  customerPhone: string;
  pickupTime: Date;
  items: unknown;
  total: number;
};

type Props = { order: OrderData };

const priceFormatter = new Intl.NumberFormat('fr-FR');

export default function NewOrderEmail({ order }: Props) {
  const items = order.items as CartItem[];
  const pickupFormatted = formatPickupTime(order.pickupTime);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? '';

  return (
    <Html lang="fr">
      <Body style={{ fontFamily: 'sans-serif', color: '#333' }}>
        <Container style={{ maxWidth: '600px', margin: '0 auto', padding: '24px' }}>
          <Heading as="h1">🛎️ Nouvelle commande EBA Coffee Shop</Heading>

          <Text>
            <strong>Référence :</strong> {order.reference}
          </Text>
          <Text>
            <strong>Retrait :</strong> {pickupFormatted}
          </Text>

          <Hr />

          <Heading as="h2">Client</Heading>
          <Text>
            <strong>Prénom :</strong> {order.customerName}
          </Text>
          <Text>
            <strong>Téléphone :</strong> {order.customerPhone}
          </Text>

          <Hr />

          <Heading as="h2">Articles</Heading>
          {items.map((item, i) => (
            <Text key={i}>
              {item.productName} x{item.quantity}
              {item.supplements.length > 0 &&
                ` — ${item.supplements.map((s) => s.optionName).join(', ')}`}
            </Text>
          ))}
          <Text>
            <strong>
              Total : {priceFormatter.format(order.total)} FCFA
            </strong>
          </Text>

          <Hr />

          <Link href={`${siteUrl}/dashboard/commandes/${order.id}`}>
            Voir la commande dans le dashboard →
          </Link>
        </Container>
      </Body>
    </Html>
  );
}
```

- [ ] **Step 4 : Lancer les tests (ils doivent passer)**

```bash
rtk vitest run "emails/new-order.test.tsx"
```

Résultat attendu :

```
✓ emails/new-order.test.tsx (8)
  ✓ NewOrderEmail > contient la référence de commande
  ✓ NewOrderEmail > contient le prénom du client
  ✓ NewOrderEmail > contient le téléphone du client
  ✓ NewOrderEmail > contient l'heure de retrait (HHhMM)
  ✓ NewOrderEmail > contient le nom des articles
  ✓ NewOrderEmail > contient le nom des suppléments
  ✓ NewOrderEmail > contient le total en FCFA
  ✓ NewOrderEmail > contient un lien vers le dashboard

Test Files  1 passed (1)
Tests       8 passed (8)
```

- [ ] **Step 5 : Commit**

```bash
rtk git add "emails/new-order.tsx" "emails/new-order.test.tsx" && rtk git commit -m "feat: add NewOrderEmail template with TDD"
```

---

## Task 3 — Modifier la route + ajouter le test d'intégration email

**Files:**
- Modify: `app/api/commandes/route.test.ts`
- Modify: `app/api/commandes/route.ts`

- [ ] **Step 1 : Modifier `route.test.ts` pour ajouter le mock email et le nouveau test**

Remplacer le contenu de `app/api/commandes/route.test.ts` par :

```ts
// app/api/commandes/route.test.ts
import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  type MockedFunction,
} from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/prisma', () => ({
  default: {
    order: {
      create: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('@/lib/email', () => ({
  sendNewOrderEmail: vi.fn().mockResolvedValue(undefined),
}));

import prisma from '@/lib/prisma';
import { sendNewOrderEmail } from '@/lib/email';
import { POST } from './route';

const mockCreate = prisma.order.create as MockedFunction<
  typeof prisma.order.create
>;
const mockFindUnique = prisma.order.findUnique as MockedFunction<
  typeof prisma.order.findUnique
>;
const mockSendNewOrderEmail = sendNewOrderEmail as MockedFunction<
  typeof sendNewOrderEmail
>;

const validBody = {
  customerName: 'Kofi',
  customerPhone: '07001234',
  pickupTime: new Date(Date.now() + 3_600_000).toISOString(),
  items: [
    {
      cartId: 'abc123',
      productId: 'prod-1',
      productName: 'Cappuccino',
      basePrice: 3500,
      quantity: 1,
      supplements: [],
    },
  ],
  total: 3500,
};

const mockOrder = {
  id: 'clorder123',
  reference: 'EBA-20260510-AB12',
  customerName: validBody.customerName,
  customerPhone: validBody.customerPhone,
  pickupTime: new Date(validBody.pickupTime),
  items: validBody.items,
  total: validBody.total,
  status: 'PENDING' as const,
  note: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost/api/commandes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/commandes', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockSendNewOrderEmail.mockResolvedValue(undefined);
  });

  it('retourne 201 avec id et reference pour un body valide', async () => {
    mockFindUnique.mockResolvedValue(null);
    mockCreate.mockResolvedValue(mockOrder);

    const res = await POST(makeRequest(validBody));
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json).toHaveProperty('id', 'clorder123');
    expect(json).toHaveProperty('reference', 'EBA-20260510-AB12');
  });

  it('retourne 400 si items est vide', async () => {
    const res = await POST(makeRequest({ ...validBody, items: [] }));
    expect(res.status).toBe(400);
  });

  it('retourne 400 si customerPhone trop court', async () => {
    const res = await POST(makeRequest({ ...validBody, customerPhone: '071' }));
    expect(res.status).toBe(400);
  });

  it('retourne 400 si total négatif', async () => {
    const res = await POST(makeRequest({ ...validBody, total: -1 }));
    expect(res.status).toBe(400);
  });

  it('retourne 400 si pickupTime invalide', async () => {
    const res = await POST(
      makeRequest({ ...validBody, pickupTime: 'pas-une-date' })
    );
    expect(res.status).toBe(400);
  });

  it("retourne 400 si body n'est pas du JSON valide", async () => {
    const req = new NextRequest('http://localhost/api/commandes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'pas du json',
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('retourne 500 si prisma échoue', async () => {
    mockFindUnique.mockResolvedValue(null);
    mockCreate.mockRejectedValue(new Error('DB error'));

    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(500);
  });

  it("l'échec de l'envoi email ne cause pas un 500", async () => {
    mockFindUnique.mockResolvedValue(null);
    mockCreate.mockResolvedValue(mockOrder);
    mockSendNewOrderEmail.mockRejectedValue(new Error('Resend error'));

    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(201);
  });
});
```

- [ ] **Step 2 : Lancer les tests existants (le nouveau test doit échouer, les autres passer)**

```bash
rtk vitest run "app/api/commandes/route.test.ts"
```

Résultat attendu : 7 tests passent, 1 échoue (`l'échec de l'envoi email ne cause pas un 500`).

- [ ] **Step 3 : Modifier `app/api/commandes/route.ts`**

```ts
// app/api/commandes/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createOrder, createOrderSchema } from '@/lib/orders';
import { sendNewOrderEmail } from '@/lib/email';

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: 'Corps de requête invalide' },
      { status: 400 }
    );
  }

  const parsed = createOrderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const order = await createOrder(parsed.data);
    sendNewOrderEmail(order).catch((err) => {
      console.error('[email] Échec notification propriétaire :', err);
    });
    return NextResponse.json(
      { id: order.id, reference: order.reference },
      { status: 201 }
    );
  } catch (err) {
    console.error('[POST /api/commandes]', err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
```

- [ ] **Step 4 : Lancer les tests de la route (tous doivent passer)**

```bash
rtk vitest run "app/api/commandes/route.test.ts"
```

Résultat attendu :

```
✓ app/api/commandes/route.test.ts (8)
  ✓ POST /api/commandes > retourne 201 avec id et reference pour un body valide
  ✓ POST /api/commandes > retourne 400 si items est vide
  ✓ POST /api/commandes > retourne 400 si customerPhone trop court
  ✓ POST /api/commandes > retourne 400 si total négatif
  ✓ POST /api/commandes > retourne 400 si pickupTime invalide
  ✓ POST /api/commandes > retourne 400 si body n'est pas du JSON valide
  ✓ POST /api/commandes > retourne 500 si prisma échoue
  ✓ POST /api/commandes > l'échec de l'envoi email ne cause pas un 500

Test Files  1 passed (1)
Tests       8 passed (8)
```

- [ ] **Step 5 : Lancer tous les tests pour vérifier aucune régression**

```bash
rtk vitest run
```

Résultat attendu : tous les tests passent.

- [ ] **Step 6 : Vérifier le build TypeScript**

```bash
rtk tsc
```

Résultat attendu : aucune erreur TypeScript.

- [ ] **Step 7 : Commit**

```bash
rtk git add "app/api/commandes/route.ts" "app/api/commandes/route.test.ts" && rtk git commit -m "feat: send owner email notification on new order (non-blocking)"
```

---

## Task 4 — Mettre à jour le statut dans la spec

**Files:**
- Modify: `docs/superpowers/specs/2026-05-10-click-and-collect-design.md`

- [ ] **Step 1 : Mettre à jour la table des statuts**

Dans `docs/superpowers/specs/2026-05-10-click-and-collect-design.md`, remplacer la ligne :

```
| 4   | Email de notification (Resend)       | ⬜ À faire |
```

par :

```
| 4   | Email de notification (Resend)       | ✅ Terminé |
```

- [ ] **Step 2 : Commit**

```bash
rtk git add "docs/superpowers/specs/2026-05-10-click-and-collect-design.md" && rtk git commit -m "docs: mark F4 as done in click-and-collect spec"
```

---

## Checklist spec (auto-review)

- [x] `sendNewOrderEmail` déclenché dans `POST /api/commandes` après création DB ✓ Task 3
- [x] Appel non-bloquant (`.catch()`) — ne rejette pas la requête ✓ Task 3
- [x] Destinataire `OWNER_EMAIL` ✓ Task 1 + test
- [x] Sujet contient la référence ✓ Task 1 + test
- [x] Template : référence + heure de retrait ✓ Task 2 + tests
- [x] Template : prénom + téléphone client ✓ Task 2 + tests
- [x] Template : liste des articles avec suppléments ✓ Task 2 + tests
- [x] Template : total FCFA ✓ Task 2 + test
- [x] Template : lien vers `/dashboard/commandes/{id}` ✓ Task 2 + test
- [x] Si `OWNER_EMAIL` absent → warning + pas d'appel Resend ✓ Task 1 + test
- [x] Si Resend échoue → `sendNewOrderEmail` rejette ✓ Task 1 + test
- [x] Échec email ne cause pas un 500 sur la route ✓ Task 3 + test
- [x] Variables d'env : `RESEND_API_KEY`, `OWNER_EMAIL` dans `.env.schema` ✓ Task 0
- [x] `NEXT_PUBLIC_SITE_URL` (déjà présente) utilisée pour le lien dashboard ✓ Task 2
