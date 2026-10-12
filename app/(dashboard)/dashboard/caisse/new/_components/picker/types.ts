import type { Product } from '@/config/menu';
import type { Selections, SupplementRules } from '@/lib/supplements';

export type Group = NonNullable<Product['supplements']>[number];

export type GroupCtx = {
  activeProduct: Product;
  selections: Selections;
  rules: SupplementRules;
  forFutureDay: boolean;
  hasRestock: boolean;
  count: number;
  max: number;
  setSingle: (groupName: string, value: string) => void;
  toggleMultiple: (groupName: string, optionName: string) => void;
  setQuantity: (groupName: string, optionName: string, delta: number) => void;
  handleOptionRestocked: (
    groupName: string,
    optionName: string,
    stockQuantity: number | null
  ) => void;
};

export type PickerCtx = Omit<GroupCtx, 'count' | 'max'>;
