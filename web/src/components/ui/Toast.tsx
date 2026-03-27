import { useToastStore } from '@/stores/toast';

const fadeInStyle: React.CSSProperties = {
  animation: 'toast-fade-in 0.2s ease-out',
};

export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  const removeToast = useToastStore((s) => s.removeToast);

  if (toasts.length === 0) return null;

  return (
    <>
      <style>{`
        @keyframes toast-fade-in {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[2000] flex flex-col items-center">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="alert"
            onClick={() => removeToast(toast.id)}
            className="bg-text text-bg px-4 py-2.5 rounded-md text-[13px] font-medium shadow-lg mb-2 cursor-pointer"
            style={fadeInStyle}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </>
  );
}
