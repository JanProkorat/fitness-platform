import { useToastStore } from '@/stores/toast';

export default function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  const removeToast = useToastStore((s) => s.removeToast);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[60] flex flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role="alert"
          onClick={() => removeToast(toast.id)}
          className={`cursor-pointer rounded-sm border px-5 py-3 text-sm font-medium shadow-lg transition-all ${
            toast.type === 'error'
              ? 'border-red-dim bg-[#1a0a0a] text-red'
              : 'border-green-bright/30 bg-[#0a1a0a] text-green-bright'
          }`}
        >
          {toast.message}
        </div>
      ))}
    </div>
  );
}
