'use client';

import { extrasPreview } from './helpers';
import { SupplementGroupCard } from './supplement-group-card';
import type { SupplementModalState } from './use-supplement-modal';

export function ExtrasSection({ modal }: { modal: SupplementModalState }) {
  const { globalGroups, showExtras, setShowExtras } = modal;
  const preview = extrasPreview(globalGroups);
  return (
    <>
      {globalGroups.length > 0 &&
        (showExtras ? (
          <div className="space-y-3 border-t pt-3">
            <p className="text-xs font-semibold tracking-wide text-foreground/40 uppercase">
              Envie d’un petit plus ?
            </p>
            {globalGroups.map((group) => (
              <SupplementGroupCard
                key={group.name}
                group={group}
                modal={modal}
              />
            ))}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowExtras(() => true)}
            className="w-full cursor-pointer rounded-xl border border-dashed border-primary/30 bg-primary/[0.04] px-3 py-2.5 text-left transition-colors hover:bg-primary/[0.08]"
          >
            <span className="text-sm font-semibold text-primary">
              Envie d’un petit plus ?
            </span>
            {preview && (
              <span className="mt-0.5 block truncate text-xs text-foreground/55">
                {preview}
              </span>
            )}
          </button>
        ))}
    </>
  );
}
