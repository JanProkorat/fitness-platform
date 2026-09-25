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
        // z-[var(--z-toast)], not z-50: toasts must render above every
        // overlay (sheet + dialog both use z-50) so an error toast raised
        // while a drawer is open stays visible and clickable (#1109). See
        // the --z-toast comment in index.css for why this isn't a
        // theme-generated z-toast class.
        "fixed bottom-0 z-[var(--z-toast)] flex max-h-screen w-full flex-col-reverse gap-2 p-4 sm:top-auto sm:right-0 sm:bottom-0 sm:max-w-sm sm:flex-col",
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
 * Auto-dismiss timing is owned by Radix, not by the store — deliberately,
 * and unlike the pre-strip implementation. Radix's per-root `duration`
 * pauses while the toast is hovered or focused, which a blind store-side
 * setTimeout cannot do; with both running, hovering to read a long error
 * pauses one timer while the other fires anyway and removes the toast
 * mid-read. Every exit path — the duration elapsing, swipe-to-dismiss, the
 * close button — funnels through `onOpenChange`, which is what takes the
 * toast out of the store's queue.
 */
const TOAST_DURATION_MS = 5000
function Toaster() {
  const toasts = useToastStore((s) => s.toasts)
  const removeToast = useToastStore((s) => s.removeToast)

  return (
    <ToastPrimitive.Provider swipeDirection="right">
      {toasts.map((toast) => (
        <ToastRoot
          key={toast.id}
          variant={toast.type}
          duration={TOAST_DURATION_MS}
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
