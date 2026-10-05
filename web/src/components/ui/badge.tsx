import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center justify-center gap-1 rounded-full border border-transparent px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-[color,box-shadow] [&_svg]:pointer-events-none [&_svg]:size-3",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground",
        secondary: "bg-secondary text-secondary-foreground",
        outline: "border-border bg-background text-foreground",
        destructive: "bg-error-soft text-error",
        // Palette board chips: soft fill + ink text (icon goes in as a child).
        training: "bg-training-soft text-training-ink",
        nutrition: "bg-nutrition-soft text-nutrition-ink",
        // Soft-fill status treatment (small rounded rect, not a pill) —
        // Figma frame client-list-02, #1066 phase 6.
        success: "rounded-sm bg-success-soft text-success-ink",
        // Ingredients table's Library column badge (System/Mine/Shared) —
        // docs/design/ingredients/inventory.md, #1115. Same small-rect
        // treatment as `success` above, not the pill shape `secondary` uses
        // elsewhere (ClientStatusBadge, PendingTable) — a dedicated variant
        // rather than restyling `secondary`, which those already rely on.
        library: "rounded-sm bg-sunken text-caption font-semibold text-ink-2",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return (
    <span
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

// badgeVariants is exported alongside the component for the same reason as
// buttonVariants (see button.tsx) — composing its classes without an
// instantiated <Badge>. shadcn/ui's own upstream convention.
// eslint-disable-next-line react-refresh/only-export-components
export { Badge, badgeVariants }
