'use client';

import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export type SupplementOption = {
  name: string;
  price: number;
  available: boolean;
};
export type SupplementGroup = {
  name: string;
  type: 'single' | 'multiple';
  required: boolean;
  available: boolean;
  options: SupplementOption[];
};

type Props = {
  groups: SupplementGroup[];
  onChange: (groups: SupplementGroup[]) => void;
};

export function SupplementsEditor({ groups, onChange }: Props) {
  function addGroup() {
    onChange([
      ...groups,
      {
        name: '',
        type: 'single',
        required: false,
        available: true,
        options: [],
      },
    ]);
  }
  function removeGroup(gi: number) {
    onChange(groups.filter((_, i) => i !== gi));
  }
  function updateGroup(gi: number, patch: Partial<SupplementGroup>) {
    onChange(groups.map((g, i) => (i === gi ? { ...g, ...patch } : g)));
  }
  function addOption(gi: number) {
    updateGroup(gi, {
      options: [...groups[gi].options, { name: '', price: 0, available: true }],
    });
  }
  function removeOption(gi: number, oi: number) {
    updateGroup(gi, {
      options: groups[gi].options.filter((_, i) => i !== oi),
    });
  }
  function updateOption(
    gi: number,
    oi: number,
    patch: Partial<SupplementOption>
  ) {
    updateGroup(gi, {
      options: groups[gi].options.map((o, i) =>
        i === oi ? { ...o, ...patch } : o
      ),
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Groupes de suppléments</span>
          <Button type="button" variant="outline" size="sm" onClick={addGroup}>
            <Plus className="mr-1 size-3" /> Ajouter un groupe
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {groups.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Aucun groupe de suppléments.
          </p>
        )}
        {groups.map((g, gi) => (
          <div key={gi} className="space-y-3 rounded-lg border p-4">
            <div className="flex items-end gap-2">
              <div className="flex-1 space-y-1.5">
                <Label>Nom du groupe</Label>
                <Input
                  value={g.name}
                  onChange={(e) => updateGroup(gi, { name: e.target.value })}
                  placeholder="ex: Choix du lait"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Type</Label>
                <select
                  value={g.type}
                  onChange={(e) =>
                    updateGroup(gi, {
                      type: e.target.value as 'single' | 'multiple',
                    })
                  }
                  className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                >
                  <option value="single">Choix unique</option>
                  <option value="multiple">Choix multiples</option>
                </select>
              </div>
              <label className="flex h-9 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={g.required}
                  onChange={(e) =>
                    updateGroup(gi, { required: e.target.checked })
                  }
                />
                Requis
              </label>
              <label className="flex h-9 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={g.available}
                  onChange={(e) =>
                    updateGroup(gi, { available: e.target.checked })
                  }
                />
                Disponible
              </label>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => removeGroup(gi)}
                aria-label="Supprimer le groupe"
              >
                <Trash2 className="size-4 text-destructive" />
              </Button>
            </div>

            <div className="space-y-2">
              <Label>Options</Label>
              {g.options.map((o, oi) => (
                <div key={oi} className="flex items-center gap-2">
                  <Input
                    placeholder="Nom"
                    value={o.name}
                    onChange={(e) =>
                      updateOption(gi, oi, { name: e.target.value })
                    }
                  />
                  <Input
                    type="number"
                    placeholder="Prix"
                    min={0}
                    step={100}
                    value={o.price}
                    onChange={(e) =>
                      updateOption(gi, oi, {
                        price: Number(e.target.value),
                      })
                    }
                    className="w-32"
                  />
                  <label className="flex h-9 shrink-0 items-center gap-1.5 text-xs whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={o.available}
                      onChange={(e) =>
                        updateOption(gi, oi, { available: e.target.checked })
                      }
                    />
                    Dispo.
                  </label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => removeOption(gi, oi)}
                    aria-label="Supprimer l'option"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => addOption(gi)}
              >
                <Plus className="mr-1 size-3" /> Ajouter une option
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
