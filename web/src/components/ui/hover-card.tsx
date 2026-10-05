import * as React from "react"
import { HoverCard as HoverCardPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

function HoverCard({
  ...props
}: React.ComponentProps<typeof HoverCardPrimitive.Root>) {
  return <HoverCardPrimitive.Root data-slot="hover-card" {...props} />
}

function HoverCardTrigger({
  ...props
}: React.ComponentProps<typeof HoverCardPrimitive.Trigger>) {
  return (
    <HoverCardPrimitive.Trigger data-slot="hover-card-trigger" {...props} />
  )
}

function HoverCardContent({
  className,
  align = "center",
  sideOffset = 4,
  ...props
}: React.ComponentProps<typeof HoverCardPrimitive.Content>) {
  return (
    <HoverCardPrimitive.Portal>
      <HoverCardPrimitive.Content
        data-slot="hover-card-content"
        align={align}
        sideOffset={sideOffset}
        className={cn(
          "z-50 w-64 rounded-lg border border-border bg-popover p-4 text-popover-foreground shadow-popover outline-none",
          "data-[state=open]:data-[side=top]:animate-popper-in-top data-[state=open]:data-[side=bottom]:animate-popper-in-bottom data-[state=open]:data-[side=left]:animate-popper-in-left data-[state=open]:data-[side=right]:animate-popper-in-right",
          "data-[state=closed]:data-[side=top]:animate-popper-out-top data-[state=closed]:data-[side=bottom]:animate-popper-out-bottom data-[state=closed]:data-[side=left]:animate-popper-out-left data-[state=closed]:data-[side=right]:animate-popper-out-right",
          className
        )}
        {...props}
      />
    </HoverCardPrimitive.Portal>
  )
}

export { HoverCard, HoverCardTrigger, HoverCardContent }
