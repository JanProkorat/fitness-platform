import { create } from 'zustand';

export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error';
}

interface ToastState {
  toasts: Toast[];
  addToast: (message: string, type: 'success' | 'error') => void;
  removeToast: (id: string) => void;
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  // Deliberately no timer here. The pre-strip store auto-dismissed on a blind
  // setTimeout, but the viewport now runs on Radix, which has its own duration
  // timer that pauses on hover and focus. Two timers would race: hovering to
  // read a long error pauses Radix's while the store's fires regardless and
  // yanks the toast out from under the cursor. Radix owns dismissal timing and
  // calls removeToast through onOpenChange — see components/ui/toast.tsx.
  addToast: (message, type) => {
    const id = crypto.randomUUID();
    set((s) => ({ toasts: [...s.toasts, { id, message, type }] }));
  },
  removeToast: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));
