# Feature 2 — Formulaire de retrait — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer le bouton WhatsApp dans le CartDrawer par un formulaire 2-étapes (récap panier → infos retrait + créneaux) qui soumet à `POST /api/commandes` et redirige vers `/commande/[id]`.

**Architecture:** La logique pure (génération de créneaux, validation et soumission du formulaire) est isolée dans `lib/` et pleinement testable sans UI. `checkout-form.tsx` est un composant React fin qui orchestre ces fonctions. `cart-drawer.tsx` reçoit un état `step` (1/2) et délègue step 2 au `CheckoutForm`.

**Tech Stack:** Vitest (globals: false — tous imports explicites), Next.js 16 App Router, HeroUI, Zustand, Tailwind CSS v4, Bun

---

## Structure des fichiers

| Action | Fichier                                       | Responsabilité                                                |
| ------ | --------------------------------------------- | ------------------------------------------------------------- |
| Create | `lib/pickup-slots.ts`                         | `generatePickupSlots(now: Date): Date[]` — fonction pure      |
| Create | `lib/pickup-slots.test.ts`                    | Tests unitaires des créneaux                                  |
| Create | `lib/checkout-submit.ts`                      | `validateCheckoutInput` + `submitCheckoutForm` — logique pure |
| Create | `lib/checkout-submit.test.ts`                 | Tests soumission avec `fetch` mocké                           |
| Create | `components/(public)/carte/checkout-form.tsx` | Composant React du formulaire (step 2)                        |
| Modify | `components/(public)/carte/cart-drawer.tsx`   | Intégrer 2 steps, supprimer WhatsApp                          |

---

## Task 1 — TDD : `lib/pickup-slots.ts`

**Files:**

- Create: `lib/pickup-slots.ts`
- Create: `lib/pickup-slots.test.ts`

- [ ] **Step 1 : Créer le fichier de test**

```ts
// lib/pickup-slots.test.ts
import { describe, it, expect } from 'vitest';
import { generatePickupSlots } from './pickup-slots';

describe('generatePickupSlots', () => {
  it('retourne des créneaux dans la plage 08h00–20h00', () => {
    const now = new Date(2026, 4, 10, 7, 0, 0); // 07:00 local
    const slots = generatePickupSlots(now);

    expect(slots.length).toBeGreaterThan(0);
    for (const slot of slots) {
      const totalMinutes = slot.getHours() * 60 + slot.getMinutes();
      expect(totalMinutes).toBeGreaterThanOrEqual(8 * 60); // >= 08:00
      expect(totalMinutes).toBeLessThanOrEqual(20 * 60); // <= 20:00
    }
  });

  it('ne retourne pas de créneaux dans les 30 prochaines minutes', () => {
    const now = new Date(2026, 4, 10, 9, 0, 0); // 09:00 local
    const minAllowed = new Date(now.getTime() + 30 * 60 * 1000); // 09:30

    const slots = generatePickupSlots(now);

    for (const slot of slots) {
      expect(slot.getTime()).toBeGreaterThanOrEqual(minAllowed.getTime());
    }
  });

  it('retourne des créneaux à intervalles de 15 min', () => {
    const now = new Date(2026, 4, 10, 7, 0, 0); // 07:00 — tous les créneaux d'aujourd'hui disponibles

    const slots = generatePickupSlots(now);
    const today = new Date(2026, 4, 10, 0, 0, 0);
    const todaySlots = slots.filter((s) => {
      const d = new Date(s.getFullYear(), s.getMonth(), s.getDate());
      return d.getTime() === today.getTime();
    });

    for (let i = 1; i < todaySlots.length; i++) {
      const diff =
        (todaySlots[i].getTime() - todaySlots[i - 1].getTime()) / 60000;
      expect(diff).toBe(15);
    }
  });

  it("inclut des créneaux pour aujourd'hui et demain", () => {
    const now = new Date(2026, 4, 10, 7, 0, 0); // 07:00 — bien avant tout créneau

    const slots = generatePickupSlots(now);

    const today = new Date(2026, 4, 10, 0, 0, 0);
    const tomorrow = new Date(2026, 4, 11, 0, 0, 0);

    const hasToday = slots.some((s) => {
      const d = new Date(s.getFullYear(), s.getMonth(), s.getDate());
      return d.getTime() === today.getTime();
    });
    const hasTomorrow = slots.some((s) => {
      const d = new Date(s.getFullYear(), s.getMonth(), s.getDate());
      return d.getTime() === tomorrow.getTime();
    });

    expect(hasToday).toBe(true);
    expect(hasTomorrow).toBe(true);
  });

  it('retourne uniquement des créneaux demain si now est après 19h30', () => {
    // now = 19:31 → minAllowed = 20:01 → aucun créneau aujourd'hui (le dernier est 20:00)
    const now = new Date(2026, 4, 10, 19, 31, 0);
    const today = new Date(2026, 4, 10, 0, 0, 0);
    const tomorrow = new Date(2026, 4, 11, 0, 0, 0);

    const slots = generatePickupSlots(now);

    const todaySlots = slots.filter((s) => {
      const d = new Date(s.getFullYear(), s.getMonth(), s.getDate());
      return d.getTime() === today.getTime();
    });
    const tomorrowSlots = slots.filter((s) => {
      const d = new Date(s.getFullYear(), s.getMonth(), s.getDate());
      return d.getTime() === tomorrow.getTime();
    });

    expect(todaySlots.length).toBe(0);
    expect(tomorrowSlots.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2 : Lancer les tests (ils doivent échouer)**

```bash
bun test lib/pickup-slots.test.ts
```

Résultat attendu : `Cannot find module './pickup-slots'`

- [ ] **Step 3 : Créer `lib/pickup-slots.ts`**

```ts
// lib/pickup-slots.ts
export function generatePickupSlots(now: Date): Date[] {
  const slots: Date[] = [];
  const minTime = new Date(now.getTime() + 30 * 60 * 1000);

  for (let dayOffset = 0; dayOffset <= 1; dayOffset++) {
    const day = new Date(now);
    day.setDate(day.getDate() + dayOffset);

    for (let hour = 8; hour <= 20; hour++) {
      const minutes = hour < 20 ? [0, 15, 30, 45] : [0];
      for (const minute of minutes) {
        const slot = new Date(day);
        slot.setHours(hour, minute, 0, 0);
        if (slot.getTime() >= minTime.getTime()) {
          slots.push(slot);
        }
      }
    }
  }

  return slots;
}
```

- [ ] **Step 4 : Lancer les tests (ils doivent passer)**

```bash
bun test lib/pickup-slots.test.ts
```

Résultat attendu :

```
✓ lib/pickup-slots.test.ts (5)
  ✓ generatePickupSlots > retourne des créneaux dans la plage 08h00–20h00
  ✓ generatePickupSlots > ne retourne pas de créneaux dans les 30 prochaines minutes
  ✓ generatePickupSlots > retourne des créneaux à intervalles de 15 min
  ✓ generatePickupSlots > inclut des créneaux pour aujourd'hui et demain
  ✓ generatePickupSlots > retourne uniquement des créneaux demain si now est après 19h30

Test Files  1 passed (1)
Tests       5 passed (5)
```

- [ ] **Step 5 : Commit**

```bash
rtk git add lib/pickup-slots.ts lib/pickup-slots.test.ts && rtk git commit -m "feat: add generatePickupSlots with TDD"
```

---

## Task 2 — TDD : `lib/checkout-submit.ts`

**Files:**

- Create: `lib/checkout-submit.ts`
- Create: `lib/checkout-submit.test.ts`

- [ ] **Step 1 : Créer le fichier de test**

```ts
// lib/checkout-submit.test.ts
import { describe, it, expect, vi, afterEach } from 'vitest';
import { validateCheckoutInput, submitCheckoutForm } from './checkout-submit';
import type { CheckoutFields } from './checkout-submit';
import type { CartItem } from '@/lib/cart-store';

const validFields: CheckoutFields = {
  customerName: 'Kofi',
  customerPhone: '07001234',
  pickupTime: '2026-05-11T10:00:00.000Z',
};

const mockItems: CartItem[] = [
  {
    cartId: 'abc',
    productId: 'prod-1',
    productName: 'Cappuccino',
    basePrice: 3500,
    quantity: 1,
    supplements: [],
  },
];

// ─── validateCheckoutInput ────────────────────────────────────────────────────

describe('validateCheckoutInput', () => {
  it('retourne un objet vide si les champs sont valides', () => {
    const errors = validateCheckoutInput(validFields);
    expect(Object.keys(errors)).toHaveLength(0);
  });

  it('retourne une erreur si customerName est vide', () => {
    const errors = validateCheckoutInput({ ...validFields, customerName: '' });
    expect(errors.customerName).toBeDefined();
  });

  it('retourne une erreur si customerName est trop court (< 2 chars)', () => {
    const errors = validateCheckoutInput({ ...validFields, customerName: 'K' });
    expect(errors.customerName).toBeDefined();
  });

  it('retourne une erreur si customerPhone est trop court (< 8 chars)', () => {
    const errors = validateCheckoutInput({
      ...validFields,
      customerPhone: '071234',
    });
    expect(errors.customerPhone).toBeDefined();
  });

  it('retourne une erreur si pickupTime est null', () => {
    const errors = validateCheckoutInput({ ...validFields, pickupTime: null });
    expect(errors.pickupTime).toBeDefined();
  });
});

// ─── submitCheckoutForm ───────────────────────────────────────────────────────

describe('submitCheckoutForm', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('appelle onError sans appeler fetch si les champs sont invalides', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch');
    const onError = vi.fn();

    await submitCheckoutForm({
      fields: { ...validFields, customerName: '' },
      items: mockItems,
      total: 3500,
      onSuccess: vi.fn(),
      onError,
    });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledOnce();
  });

  it('appelle POST /api/commandes avec les bons champs', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({ id: 'clorder123', reference: 'EBA-20260511-AB12' }),
        { status: 201 }
      )
    );

    await submitCheckoutForm({
      fields: validFields,
      items: mockItems,
      total: 3500,
      onSuccess: vi.fn(),
      onError: vi.fn(),
    });

    expect(fetch).toHaveBeenCalledWith(
      '/api/commandes',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"customerName":"Kofi"'),
      })
    );
  });

  it("appelle onSuccess avec l'id après soumission réussie", async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({ id: 'clorder123', reference: 'EBA-20260511-AB12' }),
        { status: 201 }
      )
    );

    const onSuccess = vi.fn();
    await submitCheckoutForm({
      fields: validFields,
      items: mockItems,
      total: 3500,
      onSuccess,
      onError: vi.fn(),
    });

    expect(onSuccess).toHaveBeenCalledWith('clorder123');
  });

  it("appelle onError avec un message si l'API retourne 400", async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: 'invalid' }), { status: 400 })
    );

    const onError = vi.fn();
    await submitCheckoutForm({
      fields: validFields,
      items: mockItems,
      total: 3500,
      onSuccess: vi.fn(),
      onError,
    });

    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ submit: expect.any(String) })
    );
  });

  it("appelle onError avec un message si l'API retourne 500", async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: 'server error' }), { status: 500 })
    );

    const onError = vi.fn();
    await submitCheckoutForm({
      fields: validFields,
      items: mockItems,
      total: 3500,
      onSuccess: vi.fn(),
      onError,
    });

    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ submit: expect.any(String) })
    );
  });

  it('appelle onError si fetch lève une erreur réseau', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValue(new Error('Network error'));

    const onError = vi.fn();
    await submitCheckoutForm({
      fields: validFields,
      items: mockItems,
      total: 3500,
      onSuccess: vi.fn(),
      onError,
    });

    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ submit: expect.any(String) })
    );
  });
});
```

- [ ] **Step 2 : Lancer les tests (ils doivent échouer)**

```bash
bun test lib/checkout-submit.test.ts
```

Résultat attendu : `Cannot find module './checkout-submit'`

- [ ] **Step 3 : Créer `lib/checkout-submit.ts`**

```ts
// lib/checkout-submit.ts
import type { CartItem } from '@/lib/cart-store';

export type CheckoutFields = {
  customerName: string;
  customerPhone: string;
  pickupTime: string | null;
};

export type CheckoutErrors = {
  customerName?: string;
  customerPhone?: string;
  pickupTime?: string;
  submit?: string;
};

export function validateCheckoutInput(fields: CheckoutFields): CheckoutErrors {
  const errors: CheckoutErrors = {};

  if (!fields.customerName || fields.customerName.trim().length < 2) {
    errors.customerName = 'Prénom requis (min 2 caractères)';
  }
  if (!fields.customerPhone || fields.customerPhone.trim().length < 8) {
    errors.customerPhone = 'Numéro requis (min 8 chiffres)';
  }
  if (!fields.pickupTime) {
    errors.pickupTime = 'Veuillez choisir un créneau';
  }

  return errors;
}

export type CheckoutSubmitOptions = {
  fields: CheckoutFields;
  items: CartItem[];
  total: number;
  onSuccess: (orderId: string) => void;
  onError: (errors: CheckoutErrors) => void;
};

export async function submitCheckoutForm({
  fields,
  items,
  total,
  onSuccess,
  onError,
}: CheckoutSubmitOptions): Promise<void> {
  const errors = validateCheckoutInput(fields);
  if (Object.keys(errors).length > 0) {
    onError(errors);
    return;
  }

  let response: Response;
  try {
    response = await fetch('/api/commandes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerName: fields.customerName.trim(),
        customerPhone: fields.customerPhone.trim(),
        pickupTime: fields.pickupTime,
        items,
        total,
      }),
    });
  } catch {
    onError({
      submit: 'Impossible de contacter le serveur. Veuillez réessayer.',
    });
    return;
  }

  if (!response.ok) {
    onError({ submit: 'Une erreur est survenue. Veuillez réessayer.' });
    return;
  }

  const data = (await response.json()) as { id: string };
  onSuccess(data.id);
}
```

- [ ] **Step 4 : Lancer les tests (ils doivent passer)**

```bash
bun test lib/checkout-submit.test.ts
```

Résultat attendu :

```
✓ lib/checkout-submit.test.ts (11)
  ✓ validateCheckoutInput > retourne un objet vide si les champs sont valides
  ✓ validateCheckoutInput > retourne une erreur si customerName est vide
  ✓ validateCheckoutInput > retourne une erreur si customerName est trop court
  ✓ validateCheckoutInput > retourne une erreur si customerPhone est trop court
  ✓ validateCheckoutInput > retourne une erreur si pickupTime est null
  ✓ submitCheckoutForm > appelle onError sans appeler fetch si les champs sont invalides
  ✓ submitCheckoutForm > appelle POST /api/commandes avec les bons champs
  ✓ submitCheckoutForm > appelle onSuccess avec l'id après soumission réussie
  ✓ submitCheckoutForm > appelle onError avec un message si l'API retourne 400
  ✓ submitCheckoutForm > appelle onError avec un message si l'API retourne 500
  ✓ submitCheckoutForm > appelle onError si fetch lève une erreur réseau

Test Files  1 passed (1)
Tests       11 passed (11)
```

- [ ] **Step 5 : Lancer tous les tests pour vérifier aucune régression**

```bash
bun test
```

Résultat attendu : tous les tests passent (au moins 35 tests au total).

- [ ] **Step 6 : Commit**

```bash
rtk git add lib/checkout-submit.ts lib/checkout-submit.test.ts && rtk git commit -m "feat: add checkout form validation and submit logic with TDD"
```

---

## Task 3 — Composant `checkout-form.tsx`

**Files:**

- Create: `components/(public)/carte/checkout-form.tsx`

Pas de tests unitaires pour ce composant (UI fine qui orchestre des fonctions déjà testées). La validation manuelle se fait dans Task 4.

- [ ] **Step 1 : Créer `components/(public)/carte/checkout-form.tsx`**

```tsx
// components/(public)/carte/checkout-form.tsx
'use client';

import { useState, useMemo } from 'react';
import { Button, Input } from '@heroui/react';
import { ArrowLeft } from 'lucide-react';
import { generatePickupSlots } from '@/lib/pickup-slots';
import {
  submitCheckoutForm,
  type CheckoutErrors,
  type CheckoutFields,
} from '@/lib/checkout-submit';
import type { CartItem } from '@/lib/cart-store';

type Props = {
  items: CartItem[];
  total: number;
  onBack: () => void;
  onSuccess: (orderId: string) => void;
};

export function CheckoutForm({ items, total, onBack, onSuccess }: Props) {
  const slots = useMemo(() => generatePickupSlots(new Date()), []);

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [errors, setErrors] = useState<CheckoutErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todaySlots = slots.filter((s) => {
    const d = new Date(s.getFullYear(), s.getMonth(), s.getDate());
    return d.getTime() === today.getTime();
  });
  const tomorrowSlots = slots.filter((s) => {
    const d = new Date(s.getFullYear(), s.getMonth(), s.getDate());
    return d.getTime() !== today.getTime();
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const fields: CheckoutFields = {
      customerName,
      customerPhone,
      pickupTime: selectedSlot,
    };
    setIsSubmitting(true);
    setErrors({});
    await submitCheckoutForm({
      fields,
      items,
      total,
      onSuccess,
      onError: (errs) => {
        setErrors(errs);
        setIsSubmitting(false);
      },
    });
  }

  function renderSlotGroup(groupSlots: Date[], label: string) {
    if (groupSlots.length === 0) return null;
    return (
      <div className="flex flex-col gap-1.5">
        <p className="text-xs text-foreground/50">{label}</p>
        <div className="flex flex-wrap gap-2">
          {groupSlots.map((slot) => {
            const iso = slot.toISOString();
            const h = String(slot.getHours()).padStart(2, '0');
            const m = String(slot.getMinutes()).padStart(2, '0');
            const isSelected = selectedSlot === iso;
            return (
              <button
                key={iso}
                type="button"
                onClick={() => setSelectedSlot(iso)}
                className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                  isSelected
                    ? 'border-primary bg-primary text-white'
                    : 'border-foreground/20 hover:border-primary'
                }`}
              >
                {`${h}h${m}`}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1.5 self-start text-sm text-foreground/50 transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Retour au panier
      </button>

      <Input
        label="Prénom"
        value={customerName}
        onValueChange={setCustomerName}
        isInvalid={!!errors.customerName}
        errorMessage={errors.customerName}
        isRequired
        autoComplete="given-name"
      />

      <Input
        label="Téléphone"
        value={customerPhone}
        onValueChange={setCustomerPhone}
        isInvalid={!!errors.customerPhone}
        errorMessage={errors.customerPhone}
        isRequired
        autoComplete="tel"
        placeholder="07 00 00 00 00"
      />

      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium">Créneau de retrait</p>
        {errors.pickupTime && (
          <p className="text-xs text-danger">{errors.pickupTime}</p>
        )}
        {renderSlotGroup(todaySlots, "Aujourd'hui")}
        {renderSlotGroup(tomorrowSlots, 'Demain')}
        {slots.length === 0 && (
          <p className="text-xs text-foreground/50">
            {
              "Aucun créneau disponible aujourd'hui. Revenez demain à partir de 08h00."
            }
          </p>
        )}
      </div>

      {errors.submit && <p className="text-sm text-danger">{errors.submit}</p>}

      <Button
        type="submit"
        color="primary"
        size="lg"
        className="w-full"
        isLoading={isSubmitting}
        isDisabled={isSubmitting}
      >
        Confirmer la commande
      </Button>
    </form>
  );
}
```

- [ ] **Step 2 : Vérifier que TypeScript ne signale pas d'erreur**

```bash
rtk tsc
```

Résultat attendu : aucune erreur TypeScript dans le nouveau fichier.

- [ ] **Step 3 : Commit**

```bash
rtk git add "components/(public)/carte/checkout-form.tsx" && rtk git commit -m "feat: add CheckoutForm component (step 2)"
```

---

## Task 4 — Modifier `cart-drawer.tsx`

**Files:**

- Modify: `components/(public)/carte/cart-drawer.tsx`

- [ ] **Step 1 : Remplacer le contenu de `cart-drawer.tsx`**

Ouvrir `components/(public)/carte/cart-drawer.tsx` et remplacer tout le contenu par :

```tsx
// components/(public)/carte/cart-drawer.tsx
'use client';

import { useState } from 'react';
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
} from '@heroui/react';
import { Minus, Plus, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCartStore, getItemTotal } from '@/lib/cart-store';
import { priceFormatter } from '@/config/menu';
import { CheckoutForm } from './checkout-form';

type CartDrawerProps = {
  isOpen: boolean;
  onClose: () => void;
};

function CartDrawer({ isOpen, onClose }: CartDrawerProps) {
  const router = useRouter();
  const items = useCartStore((s) => s.items);
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const removeItem = useCartStore((s) => s.removeItem);
  const clearCart = useCartStore((s) => s.clearCart);
  const totalPrice = items.reduce((sum, i) => sum + getItemTotal(i), 0);

  const [step, setStep] = useState<1 | 2>(1);

  function handleClose() {
    setStep(1);
    onClose();
  }

  function handleOrderSuccess(orderId: string) {
    clearCart();
    handleClose();
    router.push(`/commande/${orderId}`);
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      placement="center"
      size="lg"
      scrollBehavior="inside"
    >
      <ModalContent>
        <ModalHeader>
          <span className="text-lg font-semibold">
            {step === 1 ? 'Votre commande' : 'Informations de retrait'}
          </span>
        </ModalHeader>

        <ModalBody>
          {step === 1 ? (
            items.length === 0 ? (
              <p className="py-8 text-center text-sm text-foreground/50">
                Votre panier est vide
              </p>
            ) : (
              <div className="divide-y divide-foreground/5">
                {items.map((item) => (
                  <div
                    key={item.cartId}
                    className="flex items-start gap-3 py-4 first:pt-0"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-foreground">
                        {item.productName}
                      </p>
                      {item.supplements.length > 0 && (
                        <p className="mt-0.5 text-xs text-foreground/45">
                          {item.supplements.map((s) => s.optionName).join(', ')}
                        </p>
                      )}
                      <p className="mt-1 text-sm font-medium text-primary">
                        {priceFormatter.format(getItemTotal(item))}&nbsp;F
                      </p>
                    </div>

                    <div className="flex shrink-0 items-center gap-1.5">
                      <Button
                        isIconOnly
                        size="sm"
                        variant="flat"
                        radius="full"
                        aria-label="Retirer un"
                        onPress={() =>
                          updateQuantity(item.cartId, item.quantity - 1)
                        }
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </Button>
                      <span className="w-6 text-center text-sm font-medium">
                        {item.quantity}
                      </span>
                      <Button
                        isIconOnly
                        size="sm"
                        variant="flat"
                        radius="full"
                        aria-label="Ajouter un"
                        onPress={() =>
                          updateQuantity(item.cartId, item.quantity + 1)
                        }
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        isIconOnly
                        size="sm"
                        variant="light"
                        radius="full"
                        color="danger"
                        aria-label="Supprimer"
                        onPress={() => removeItem(item.cartId)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
            <CheckoutForm
              items={items}
              total={totalPrice}
              onBack={() => setStep(1)}
              onSuccess={handleOrderSuccess}
            />
          )}
        </ModalBody>

        {step === 1 && items.length > 0 && (
          <ModalFooter className="flex-col gap-3">
            <div className="flex w-full items-center justify-between">
              <span className="text-base font-semibold">Total</span>
              <span className="text-lg font-bold text-primary">
                {priceFormatter.format(totalPrice)}&nbsp;F
              </span>
            </div>

            <Button
              color="primary"
              className="w-full"
              size="lg"
              onPress={() => setStep(2)}
            >
              Passer la commande
            </Button>

            <button
              onClick={() => {
                clearCart();
                handleClose();
              }}
              className="text-xs text-foreground/40 transition-colors hover:text-destructive"
            >
              Vider le panier
            </button>
          </ModalFooter>
        )}
      </ModalContent>
    </Modal>
  );
}

export default CartDrawer;
```

- [ ] **Step 2 : Lancer tous les tests pour vérifier aucune régression**

```bash
bun test
```

Résultat attendu : tous les tests passent.

- [ ] **Step 3 : Vérifier le build TypeScript**

```bash
rtk tsc
```

Résultat attendu : aucune erreur TypeScript.

- [ ] **Step 4 : Commit**

```bash
rtk git add "components/(public)/carte/cart-drawer.tsx" && rtk git commit -m "feat: replace WhatsApp button with 2-step checkout form in CartDrawer"
```

---

## Vérification manuelle (après implémentation)

Lancer le serveur de dev :

```bash
bun dev
```

Ouvrir `http://localhost:3000/carte` dans un navigateur.

**Scénario 1 — Flux complet :**

1. Ajouter un article au panier → ouvrir le CartDrawer → voir step 1 (récap + "Passer la commande")
2. Cliquer "Passer la commande" → step 2 s'affiche avec le titre "Informations de retrait"
3. Remplir prénom, téléphone, cliquer sur un créneau
4. Cliquer "Confirmer la commande" → spinner, puis redirect vers `/commande/[id]`
5. Vérifier que le panier est vide en rouvrant le CartDrawer

**Scénario 2 — Validation :**

1. Step 2, laisser tous les champs vides → cliquer "Confirmer" → messages d'erreur sous chaque champ
2. Remplir prénom seul → erreur téléphone + créneau toujours affichées

**Scénario 3 — Retour :**

1. Step 2 → cliquer "Retour au panier" → step 1 s'affiche avec le récap et le total

**Scénario 4 — Fermeture et réouverture :**

1. Step 2 → fermer le modal → rouvrir → step 1 doit s'afficher (reset automatique)

**Scénario 5 — Aucun créneau aujourd'hui (simulation) :**
Modifier temporairement `generatePickupSlots` pour tester avec `now` après 19h30 : seule la section "Demain" doit apparaître.

---

## Checklist spec (auto-review)

- [x] Remplace le bouton "Commander via WhatsApp" ✓ Task 4
- [x] Step 1 : récapitulatif du panier + bouton "Passer la commande" ✓ Task 4
- [x] Step 2 : champs prénom, téléphone, créneaux ✓ Task 3
- [x] Créneaux 08h00–20h00, intervalles 15 min, min 30 min depuis maintenant ✓ Task 1
- [x] Créneaux pour aujourd'hui + demain ✓ Task 1
- [x] Formulaire invalide si prénom vide → erreur affichée ✓ Task 2 + Task 3
- [x] Formulaire invalide si téléphone trop court → erreur affichée ✓ Task 2 + Task 3
- [x] Formulaire invalide si aucun créneau sélectionné → erreur affichée ✓ Task 2 + Task 3
- [x] Soumission → POST /api/commandes ✓ Task 2
- [x] Succès → onSuccess(orderId) → clearCart + fermer + redirect /commande/[id] ✓ Task 4
- [x] Erreur 400/500 → message d'erreur inline ✓ Task 2 + Task 3
- [x] "Retour au panier" depuis step 2 ✓ Task 3 + Task 4
- [x] Fermeture du modal reset step 1 ✓ Task 4
