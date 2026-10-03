import { create } from 'zustand';

export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error';
  /** False once dismissed; the toast stays mounted until its exit animation can finish. */
  open: boolean;
}

interface ToastState {
  toasts: Toast[];
  addToast: (message: string, type: 'success' | 'error') => void;
  /** Marks a toast closed so it can play its exit animation, then drops it. */
  closeToast: (id: string) => void;
  removeToast: (id: string) => void;
}

// Longer than the toast exit animation, so the element is never removed mid-exit.
const EXIT_CLEANUP_MS = 400;

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  // Deliberately no auto-dismiss timer here. The pre-strip store auto-dismissed on a blind
  // setTimeout, but the viewport now runs on Radix, which has its own duration
  // timer that pauses on hover and focus. Two timers would race: hovering to
  // read a long error pauses Radix's while the store's fires regardless and
  // yanks the toast out from under the cursor. Radix owns dismissal timing and
  // calls closeToast through onOpenChange — see components/ui/toast.tsx.
  addToast: (message, type) => {
    const id = crypto.randomUUID();
    set((s) => ({
      toasts: [...s.toasts.filter((t) => t.open), { id, message, type, open: true }],
    }));
  },
  // Removal is deferred rather than driven by React's onAnimationEnd: Radix's
  // Presence unmounts on the same native animationend event, so a React
  // handler on the same node may never run.
  closeToast: (id) => {
    set((s) => ({
      toasts: s.toasts.map((t) => (t.id === id ? { ...t, open: false } : t)),
    }));
    setTimeout(() => get().removeToast(id), EXIT_CLEANUP_MS);
  },
  removeToast: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));
