import { isAvailableToday } from '@/lib/supplements';
import { formatAvailableDaysLabel } from '@/components/(public)/carte/_components/availability-labels';
import type { MenuCategory } from '@/config/menu';

export function CategoryNav({
  categories,
  currentId,
  onSelect,
}: {
  categories: MenuCategory[];
  currentId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <nav
      className="flex gap-1 overflow-x-auto py-3 scrollbar-none"
      aria-label="Catégories du menu"
    >
      {categories.map((cat) => {
        // Même donnée que l'en-tête de section.
        const closedToday = !isAvailableToday(cat.availableDays);
        const daysLabel = closedToday
          ? formatAvailableDaysLabel(cat.availableDays ?? [])
          : null;
        const isActive = currentId === cat.id;
        return (
          <button
            key={cat.id}
            data-active={isActive}
            aria-current={isActive ? 'true' : undefined}
            aria-label={daysLabel ? `${cat.name} — ${daysLabel}` : undefined}
            title={daysLabel ?? undefined}
            onClick={() => onSelect(cat.id)}
            className={`flex shrink-0 items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition-colors duration-200 ${
              isActive
                ? 'bg-primary text-primary-foreground'
                : 'text-foreground/60 hover:bg-foreground/5 hover:text-foreground'
            } ${closedToday && !isActive ? 'opacity-50' : ''}`}
          >
            {cat.name}
            {/* Produits AFFICHÉS, pas « commandables » : dépendrait de l'heure
                client et divergerait du HTML ISR. */}
            <span
              className={isActive ? 'text-primary-foreground/70' : 'opacity-60'}
            >
              {cat.products.length}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
