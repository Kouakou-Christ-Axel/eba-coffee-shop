import { CheckCircle2, ChefHat, Receipt, ShoppingBag } from 'lucide-react';

export const STATUS_STEPS = [
  { status: 'NEW', label: 'Reçue', Icon: Receipt },
  { status: 'PREPARING', label: 'En préparation', Icon: ChefHat },
  { status: 'READY', label: 'Prête', Icon: ShoppingBag },
  { status: 'COMPLETED', label: 'Récupérée', Icon: CheckCircle2 },
] as const;

export const STATUS_INDEX: Record<string, number> = {
  NEW: 0,
  PREPARING: 1,
  READY: 2,
  COMPLETED: 3,
};
