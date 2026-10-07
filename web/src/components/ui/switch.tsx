import * as React from "react"
import { Switch as SwitchPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

// Radix renders a hidden bubble input as a sibling of the button; the wrapper
// is its positioned ancestor so it cannot escape and stretch the document.
function Switch({
  className,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <span className="relative inline-flex shrink-0">
      <SwitchPrimitive.Root
        data-slot="switch"
        className={cn(
          "peer inline-flex h-6 w-10.5 shrink-0 items-center rounded-full border border-transparent bg-faint outline-none transition-colors disabled:cursor-not-allowed disabled:opacity-50",
          "focus-visible:ring-3 focus-visible:ring-ring/50",
          "data-[state=checked]:bg-nutrition",
          className
        )}
        {...props}
      >
        <SwitchPrimitive.Thumb
          data-slot="switch-thumb"
          className="pointer-events-none block size-4.5 rounded-full bg-surface shadow-selection-bar transition-transform data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0.5"
        />
      </SwitchPrimitive.Root>
    </span>
  )
}

export { Switch }
