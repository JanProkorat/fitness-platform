import { useState, useCallback } from 'react';

/**
 * Manages dialog state for create/edit modals.
 *
 * - `item` is `null` when closed, the edited item when editing, or `undefined` when creating new.
 * - `isOpen` is `true` whenever the dialog should be visible.
 * - `openNew()` opens the dialog in create mode.
 * - `openEdit(item)` opens the dialog in edit mode.
 * - `close()` closes the dialog.
 */
export function useDialogState<T>() {
  const [state, setState] = useState<T | null | 'new'>(null);

  const isOpen = state !== null;
  const item = state === 'new' ? null : state;

  const openNew = useCallback(() => setState('new'), []);
  const openEdit = useCallback((value: T) => setState(value), []);
  const close = useCallback(() => setState(null), []);

  return { item, isOpen, openNew, openEdit, close } as const;
}
