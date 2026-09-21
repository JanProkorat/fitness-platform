import * as React from "react"
import { Dialog as SheetPrimitive } from "radix-ui"
import { cva, type VariantProps } from "class-variance-authority"
import { XIcon } from "lucide-react"
import { useTranslation } from "react-i18next"

import { cn } from "@/lib/utils"

function Sheet({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Root>) {
  return <SheetPrimitive.Root data-slot="sheet" {...props} />
}

function SheetTrigger({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Trigger>) {
  return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />
}

function SheetClose({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Close>) {
  return <SheetPrimitive.Close data-slot="sheet-close" {...props} />
}

function SheetPortal({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Portal>) {
  return <SheetPrimitive.Portal data-slot="sheet-portal" {...props} />
}

function SheetOverlay({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Overlay>) {
  return (
    <SheetPrimitive.Overlay
      data-slot="sheet-overlay"
      className={cn(
        "fixed inset-0 z-50 bg-ink/50 data-[state=open]:animate-sheet-overlay-in data-[state=closed]:animate-sheet-overlay-out",
        className
      )}
      {...props}
    />
  )
}

// Each side needs its own DISTINCT enter/exit @keyframes pair -- see the
// #1081 comment on the --animate-sheet-* tokens in index.css for why a
// single reversible keyframe doesn't work with Radix's Presence.
const sheetVariants = cva(
  "fixed z-50 flex flex-col gap-4 border-border bg-card text-card-foreground shadow-panel",
  {
    variants: {
      side: {
        right:
          "inset-y-0 right-0 h-full w-3/4 border-l data-[state=open]:animate-sheet-in-right data-[state=closed]:animate-sheet-out-right sm:max-w-sm",
        left: "inset-y-0 left-0 h-full w-3/4 border-r data-[state=open]:animate-sheet-in-left data-[state=closed]:animate-sheet-out-left sm:max-w-sm",
        top: "inset-x-0 top-0 h-auto border-b data-[state=open]:animate-sheet-in-top data-[state=closed]:animate-sheet-out-top",
        bottom:
          "inset-x-0 bottom-0 h-auto border-t data-[state=open]:animate-sheet-in-bottom data-[state=closed]:animate-sheet-out-bottom",
      },
    },
    defaultVariants: {
      side: "right",
    },
  }
)

function SheetContent({
  className,
  children,
  side = "right",
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Content> &
  VariantProps<typeof sheetVariants>) {
  const { t } = useTranslation()

  return (
    <SheetPortal>
      <SheetOverlay />
      <SheetPrimitive.Content
        data-slot="sheet-content"
        className={cn(sheetVariants({ side }), className)}
        {...props}
      >
        {children}
        <SheetPrimitive.Close className="absolute top-4 right-4 rounded-md opacity-70 outline-none transition-opacity hover:opacity-100 focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none">
          <XIcon className="size-4" />
          <span className="sr-only">{t("common.close")}</span>
        </SheetPrimitive.Close>
      </SheetPrimitive.Content>
    </SheetPortal>
  )
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-header"
      className={cn("flex flex-col gap-1.5 p-4", className)}
      {...props}
    />
  )
}

function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-footer"
      className={cn("mt-auto flex flex-col gap-2 p-4", className)}
      {...props}
    />
  )
}

function SheetTitle({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Title>) {
  return (
    <SheetPrimitive.Title
      data-slot="sheet-title"
      className={cn("font-semibold text-foreground", className)}
      {...props}
    />
  )
}

function SheetDescription({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Description>) {
  return (
    <SheetPrimitive.Description
      data-slot="sheet-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
}

// sheetVariants is exported alongside the component for the same reason as
// buttonVariants (see button.tsx) — composing its classes without an
// instantiated <SheetContent>. shadcn/ui's own upstream convention.
// eslint-disable-next-line react-refresh/only-export-components
export { sheetVariants }
