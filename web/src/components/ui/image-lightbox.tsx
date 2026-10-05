import { Dialog as DialogPrimitive } from "radix-ui"
import { ChevronLeftIcon, ChevronRightIcon, XIcon } from "lucide-react"
import { useTranslation } from "react-i18next"

import { Dialog, DialogPortal, DialogOverlay, DialogClose } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

interface ImageLightboxGallery {
  /** Every picture, in viewing order. */
  images: string[]
  index: number
  onIndexChange: (index: number) => void
}

interface ImageLightboxProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  src: string
  alt: string
  /** Optional multi-picture mode: prev/next buttons and arrow keys step through `images`. */
  gallery?: ImageLightboxGallery
}

const NAV_BUTTON_CLASS =
  "absolute top-1/2 -translate-y-1/2 rounded-md p-2 text-on-dark opacity-80 outline-none transition-opacity hover:opacity-100 focus-visible:ring-3 focus-visible:ring-ring/50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-8"

/**
 * Full-screen viewer for a picture (#1140) — opens a drawer/card picture over
 * a dark overlay, scaled to fit the viewport. Built on the shared Dialog
 * primitives, so Escape-to-close and click-backdrop-to-close come for free
 * from Radix. Single picture by default; pass `gallery` to step through several.
 */
function ImageLightbox({ open, onOpenChange, src, alt, gallery }: ImageLightboxProps) {
  const { t } = useTranslation()

  const count = gallery?.images.length ?? 0
  const canStep = gallery !== undefined && count > 1
  const shownSrc = gallery ? (gallery.images[gallery.index] ?? src) : src

  function step(delta: number) {
    if (!gallery || count < 2) {
      return
    }
    gallery.onIndexChange((gallery.index + delta + count) % count)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay className="bg-scrim/90" />
        <DialogPrimitive.Content
          data-slot="dialog-content"
          aria-describedby={undefined}
          className={cn(
            "fixed inset-0 z-50 flex items-center justify-center p-8 outline-none",
            "data-[state=open]:animate-dialog-in data-[state=closed]:animate-dialog-out",
          )}
          onKeyDown={(event) => {
            if (!canStep) {
              return
            }
            if (event.key === "ArrowLeft") {
              step(-1)
            } else if (event.key === "ArrowRight") {
              step(1)
            }
          }}
        >
          <DialogPrimitive.Title className="sr-only">{alt}</DialogPrimitive.Title>
          <img src={shownSrc} alt={alt} className="max-h-full max-w-full object-contain" />
          {canStep && (
            <>
              <button type="button" className={cn(NAV_BUTTON_CLASS, "left-4")} onClick={() => step(-1)}>
                <ChevronLeftIcon />
                <span className="sr-only">{t("library.picture.previous")}</span>
              </button>
              <button type="button" className={cn(NAV_BUTTON_CLASS, "right-4")} onClick={() => step(1)}>
                <ChevronRightIcon />
                <span className="sr-only">{t("library.picture.next")}</span>
              </button>
            </>
          )}
          <DialogClose className="absolute top-4 right-4 rounded-md text-on-dark opacity-80 outline-none transition-opacity hover:opacity-100 focus-visible:ring-3 focus-visible:ring-ring/50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-6">
            <XIcon />
            <span className="sr-only">{t("common.close")}</span>
          </DialogClose>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  )
}

export { ImageLightbox }
