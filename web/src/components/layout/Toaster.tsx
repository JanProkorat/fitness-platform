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
              ? 'border-red-br bg-red-bg text-red'
              : 'border-green-br bg-green-bg text-green'
          }`}
        >
          {toast.message}
        </div>
      ))}
    </div>
  );
}
