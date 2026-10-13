'use client';

import { cn } from '@/lib/utils';
import type { MenuCategory } from '@/config/menu';

export function CategoryTabs({
  menu,
  activeCategoryId,
  onSelect,
}: {
  menu: MenuCategory[];
  activeCategoryId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
      {menu.map((cat) => {
        const isActive = cat.id === activeCategoryId;
        return (
          <button
            key={cat.id}
            type="button"
            onClick={() => onSelect(cat.id)}
            className={cn(
              'h-11 shrink-0 rounded-full px-4 text-sm font-medium transition-colors',
              isActive
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/70'
            )}
          >
            {cat.name}
          </button>
        );
      })}
    </div>
  );
}
