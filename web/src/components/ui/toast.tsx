import * as React from "react"
import { Toast as ToastPrimitive } from "radix-ui"
import { XIcon } from "lucide-react"
import { useTranslation } from "react-i18next"

import { cn } from "@/lib/utils"
import { useToastStore } from "@/stores/toast"

function ToastViewport({
  className,
  ...props
}: React.ComponentProps<typeof ToastPrimitive.Viewport>) {
  return (
    <ToastPrimitive.Viewport
      data-slot="toast-viewport"
      className={cn(
        "fixed bottom-0 z-50 flex max-h-screen w-full flex-col-reverse gap-2 p-4 sm:top-auto sm:right-0 sm:bottom-0 sm:max-w-sm sm:flex-col",
        className
      )}
      {...props}
    />
  )
}

function ToastRoot({
  className,
  variant = "success",
  ...props
}: React.ComponentProps<typeof ToastPrimitive.Root> & {
  variant?: "success" | "error"
}) {
  return (
    <ToastPrimitive.Root
      data-slot="toast"
      data-variant={variant}
      className={cn(
        "pointer-events-auto relative flex w-full items-start gap-3 rounded-lg border border-border bg-card p-4 text-card-foreground shadow-panel",
        "transition-opacity data-[state=closed]:opacity-0 data-[state=open]:opacity-100 data-[swipe=move]:transition-none",
        "data-[variant=error]:border-destructive/30",
        className
      )}
      {...props}
    />
  )
}

function ToastTitle({
  className,
  ...props
}: React.ComponentProps<typeof ToastPrimitive.Title>) {
  return (
    <ToastPrimitive.Title
      data-slot="toast-title"
      className={cn("text-sm font-medium text-foreground", className)}
      {...props}
    />
  )
}

function ToastClose({
  className,
  ...props
}: React.ComponentProps<typeof ToastPrimitive.Close>) {
  const { t } = useTranslation()
  return (
    <ToastPrimitive.Close
      data-slot="toast-close"
      className={cn(
        "absolute top-2 right-2 rounded-md p-1 text-muted-foreground opacity-70 outline-none transition-opacity hover:opacity-100 focus-visible:ring-3 focus-visible:ring-ring/50",
        className
      )}
      {...props}
    >
      <XIcon className="size-3.5" />
      <span className="sr-only">{t("common.close")}</span>
    </ToastPrimitive.Close>
  )
}

/**
 * Renders the toast store's queue on Radix's Toast primitive, so aria-live,
 * swipe dismiss and focus management come for free. Mount once, app-wide
 * (see App.tsx).
 *
 * Auto-dismiss timing is owned by the store (`useToastStore`'s own 5s
 * timer), not by Radix's per-root `duration` — the store is the single
 * source of truth for when a toast leaves the queue, so each Root's own
 * duration is disabled here to avoid two independent timers racing to
 * remove the same toast. Swipe-to-dismiss and the close button still go
 * through Radix's `onOpenChange`, which removes the toast immediately.
 */
function Toaster() {
  const toasts = useToastStore((s) => s.toasts)
  const removeToast = useToastStore((s) => s.removeToast)

  return (
    <ToastPrimitive.Provider swipeDirection="right">
      {toasts.map((toast) => (
        <ToastRoot
          key={toast.id}
          variant={toast.type}
          duration={Infinity}
          onOpenChange={(open) => {
            if (!open) {
              removeToast(toast.id)
            }
          }}
        >
          <ToastTitle className="flex-1">{toast.message}</ToastTitle>
          <ToastClose />
        </ToastRoot>
      ))}
      <ToastViewport />
    </ToastPrimitive.Provider>
  )
}

export { Toaster, ToastViewport, ToastRoot as Toast, ToastTitle, ToastClose }
