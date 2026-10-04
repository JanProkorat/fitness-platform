import * as React from "react"
import { Tabs as TabsPrimitive } from "radix-ui"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

function Tabs({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      className={cn("flex flex-col gap-2", className)}
      {...props}
    />
  )
}

// "default" is the original boxed-pill track (grey rounded background,
// active tab lifted onto a white pill) — kept for any future consumer that
// wants that look. "underline" is the wireframe-matched style used by the
// Clients page: a full-width row with a single bottom hairline, each tab's
// own bottom border doubling as the active indicator.
const tabsListVariants = cva("items-center", {
  variants: {
    variant: {
      default: "inline-flex h-9 w-fit justify-center rounded-lg bg-muted p-1 text-muted-foreground",
      underline: "flex w-full justify-start gap-4 border-b border-border",
    },
  },
  defaultVariants: {
    variant: "default",
  },
})

function TabsList({
  className,
  variant,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List> & VariantProps<typeof tabsListVariants>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn(tabsListVariants({ variant }), className)}
      {...props}
    />
  )
}

const tabsTriggerVariants = cva(
  "inline-flex items-center justify-center gap-1.5 text-sm font-medium whitespace-nowrap outline-none transition-[color,box-shadow] focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "flex-1 rounded-md border border-transparent px-2 py-1 text-foreground focus-visible:border-ring data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm",
        underline:
          "border-b-2 border-transparent px-0 pb-3 text-muted-foreground data-[state=active]:border-ink data-[state=active]:font-semibold data-[state=active]:text-ink",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function TabsTrigger({
  className,
  variant,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger> & VariantProps<typeof tabsTriggerVariants>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(tabsTriggerVariants({ variant }), className)}
      {...props}
    />
  )
}

function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn("flex-1 outline-none", className)}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent }
