'use client';

import { useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { useUndoToast } from '@/lib/hooks/use-undo-toast';
import type { SupplementGroup } from '@/lib/supplements-form';
import {
  emptyGroup,
  emptyOption,
  fromUiGroup,
  toUiGroup,
  type UiGroup,
  type UiOption,
} from './model';

export function useSupplementsEditor({
  groups,
  onChange,
  issues,
}: {
  groups: SupplementGroup[];
  onChange: (groups: SupplementGroup[]) => void;
  issues?: ReadonlyMap<number, unknown>;
}) {
  const { pushUndo } = useUndoToast();
  const reduceMotion = useReducedMotion();

  // `groups` n'est lu qu'au montage : l'onglet démonte l'éditeur en le quittant, le miroir ne peut pas diverger.
  const [ui, setUi] = useState<UiGroup[]>(() => groups.map(toUiGroup));
  const [openIds, setOpenIds] = useState<ReadonlySet<string>>(() =>
    ui.length === 1 ? new Set([ui[0].uid]) : new Set()
  );
  const [pendingDelete, setPendingDelete] = useState<UiGroup | null>(null);

  // Un groupe fautif s'ouvre (ajustement pendant le rendu) ; `openIds` reste la source unique de vérité du `<details>`.
  const issueKey = issues ? [...issues.keys()].join(',') : '';
  const [prevIssueKey, setPrevIssueKey] = useState(issueKey);
  if (issueKey !== prevIssueKey) {
    setPrevIssueKey(issueKey);
    if (issues && issues.size > 0) {
      const faulty = [...issues.keys()]
        .map((gi) => ui[gi]?.uid)
        .filter((uid): uid is string => Boolean(uid));
      setOpenIds((prev) => new Set([...prev, ...faulty]));
    }
  }

  function commit(next: UiGroup[]) {
    setUi(next);
    onChange(next.map(fromUiGroup));
  }

  function setOpen(uid: string, open: boolean) {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (open) next.add(uid);
      else next.delete(uid);
      return next;
    });
  }

  function addGroup() {
    const group = emptyGroup();
    commit([...ui, group]);
    setOpen(group.uid, true);
  }

  function updateGroup(uid: string, patch: Partial<UiGroup>) {
    commit(ui.map((g) => (g.uid === uid ? { ...g, ...patch } : g)));
  }

  function removeGroup(group: UiGroup) {
    commit(ui.filter((g) => g.uid !== group.uid));
    setPendingDelete(null);
  }

  function requestRemoveGroup(group: UiGroup) {
    const filled =
      group.name.trim() !== '' ||
      group.options.some((o) => o.name.trim() !== '');
    if (filled) setPendingDelete(group);
    else removeGroup(group);
  }

  function addOption(uid: string) {
    const group = ui.find((g) => g.uid === uid);
    if (!group) return;
    updateGroup(uid, { options: [...group.options, emptyOption()] });
  }

  function updateOption(
    groupUid: string,
    optionUid: string,
    patch: Partial<UiOption>
  ) {
    const group = ui.find((g) => g.uid === groupUid);
    if (!group) return;
    updateGroup(groupUid, {
      options: group.options.map((o) =>
        o.uid === optionUid ? { ...o, ...patch } : o
      ),
    });
  }

  function removeOption(groupUid: string, option: UiOption) {
    const group = ui.find((g) => g.uid === groupUid);
    if (!group) return;
    const index = group.options.findIndex((o) => o.uid === option.uid);
    updateGroup(groupUid, {
      options: group.options.filter((o) => o.uid !== option.uid),
    });

    pushUndo({
      message: `Option « ${option.name.trim() || 'sans nom'} » supprimée`,
      onUndo: () => {
        // Réinsertion dans l'état COURANT : l'ancien tableau effacerait les frappes faites depuis.
        setUi((prev) => {
          const next = prev.map((g) => {
            if (g.uid !== groupUid) return g;
            const options = [...g.options];
            options.splice(Math.min(index, options.length), 0, option);
            return { ...g, options };
          });
          onChange(next.map(fromUiGroup));
          return next;
        });
      },
    });
  }

  function reorderGroups(uids: string[]) {
    const byUid = new Map(ui.map((g) => [g.uid, g]));
    commit(
      uids
        .map((uid) => byUid.get(uid))
        .filter((g): g is UiGroup => g !== undefined)
    );
  }

  return {
    ui,
    openIds,
    pendingDelete,
    setPendingDelete,
    reduceMotion,
    setOpen,
    addGroup,
    updateGroup,
    removeGroup,
    requestRemoveGroup,
    addOption,
    updateOption,
    removeOption,
    reorderGroups,
  };
}
