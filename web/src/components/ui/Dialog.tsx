import { useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: number;
}

export function Dialog({ open, onClose, title, children, footer, maxWidth = 520 }: DialogProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (!open) return;
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, handleKeyDown]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center p-5 bg-black/45"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="bg-bg rounded-lg border border-border-md max-h-[90vh] overflow-y-auto flex flex-col w-full shadow-[0_8px_40px_rgba(0,0,0,0.15)]"
        style={{ maxWidth }}
      >
        {/* Header */}
        <div className="flex items-center gap-2 px-5 py-4 border-b border-border shrink-0">
          <h2 className="text-[15px] font-semibold text-text flex-1">{title}</h2>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-sm border-none bg-transparent text-text3 cursor-pointer flex items-center justify-center text-base hover:bg-bg-hover hover:text-text transition-colors"
            aria-label="Close dialog"
          >
            &times;
          </button>
        </div>

        {/* Body */}
        <div className="p-5 flex-1">{children}</div>

        {/* Footer */}
        {footer && (
          <div className="px-5 py-3.5 border-t border-border flex items-center justify-end gap-2 shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
