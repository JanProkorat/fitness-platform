import { Dialog as DialogPrimitive } from "radix-ui"
import { XIcon } from "lucide-react"
import { useTranslation } from "react-i18next"

import { Dialog, DialogPortal, DialogOverlay, DialogClose } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

interface ImageLightboxProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  src: string
  alt: string
}

/**
 * Full-screen viewer for a single picture (#1140) — opens a drawer/card
 * picture over a dark overlay, scaled to fit the viewport. Built on the
 * shared Dialog primitives, so Escape-to-close and click-backdrop-to-close
 * come for free from Radix. Single picture only — no prev/next.
 */
function ImageLightbox({ open, onOpenChange, src, alt }: ImageLightboxProps) {
  const { t } = useTranslation()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay className="bg-ink/90" />
        <DialogPrimitive.Content
          data-slot="dialog-content"
          aria-describedby={undefined}
          className={cn(
            "fixed inset-0 z-50 flex items-center justify-center p-8 outline-none",
            "transition-opacity data-[state=closed]:opacity-0 data-[state=open]:opacity-100",
          )}
        >
          <DialogPrimitive.Title className="sr-only">{alt}</DialogPrimitive.Title>
          <img src={src} alt={alt} className="max-h-full max-w-full object-contain" />
          <DialogClose className="absolute top-4 right-4 rounded-md text-paper opacity-80 outline-none transition-opacity hover:opacity-100 focus-visible:ring-3 focus-visible:ring-ring/50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-6">
            <XIcon />
            <span className="sr-only">{t("common.close")}</span>
          </DialogClose>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  )
}

export { ImageLightbox }
