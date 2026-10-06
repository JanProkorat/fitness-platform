import * as React from "react"
import { X } from "lucide-react"

import { cn } from "@/lib/utils"

interface TagInputProps {
  value: string[]
  onChange: (value: string[]) => void
  id?: string
  placeholder?: string
  /** Accessible name for the remove button of one tag. */
  removeLabel: (tag: string) => string
  className?: string
  invalid?: boolean
  "aria-describedby"?: string
}

/** Chip list with a trailing text box: Enter adds, x removes, Backspace on an empty box removes the last chip. */
function TagInput({
  value,
  onChange,
  id,
  placeholder,
  removeLabel,
  className,
  invalid,
  "aria-describedby": describedBy,
}: TagInputProps) {
  const [draft, setDraft] = React.useState("")
  const inputRef = React.useRef<HTMLInputElement>(null)

  function commit() {
    const next = draft.trim()
    if (next === "") return
    const exists = value.some((tag) => tag.toLowerCase() === next.toLowerCase())
    if (!exists) onChange([...value, next])
    setDraft("")
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      // Keep Enter from submitting the surrounding form.
      event.preventDefault()
      commit()
    } else if (event.key === "Backspace" && draft === "" && value.length > 0) {
      onChange(value.slice(0, -1))
    }
  }

  return (
    <div
      data-slot="tag-input"
      aria-invalid={invalid || undefined}
      onClick={() => inputRef.current?.focus()}
      className={cn(
        "flex min-h-10 w-full flex-wrap items-center gap-1.5 rounded-field border border-input bg-background px-2 py-1.5 transition-[color,box-shadow]",
        "focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50",
        "aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20",
        className
      )}
    >
      {value.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center gap-1.5 rounded-full bg-muted py-1 pr-1.5 pl-3 text-body font-medium text-ink-2"
        >
          {tag}
          <button
            type="button"
            aria-label={removeLabel(tag)}
            onClick={(event) => {
              event.stopPropagation()
              onChange(value.filter((entry) => entry !== tag))
            }}
            className="flex size-4 cursor-pointer items-center justify-center rounded-full text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            <X className="size-3" aria-hidden="true" />
          </button>
        </span>
      ))}
      <input
        ref={inputRef}
        id={id}
        value={draft}
        placeholder={placeholder}
        aria-describedby={describedBy}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={handleKeyDown}
        className="h-7 min-w-32 flex-1 bg-transparent px-1 text-body text-foreground outline-none placeholder:text-faint"
      />
    </div>
  )
}

export { TagInput }
