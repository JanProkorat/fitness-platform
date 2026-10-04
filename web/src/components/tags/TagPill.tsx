interface Props {
  name: string;
  colorHex?: string | null;
}

/**
 * Generalised coloured tag chip, shared by client tags and food tags (#1120)
 * — see `ClientTagPill`/`FoodTagLookup` call sites. A tag's `colorHex` is
 * per-coach runtime data chosen in the tag editor, not a design token — the
 * inline `style` here is the code-style rule's own carve-out for a value
 * that genuinely can't be expressed as a static class
 * (rules/code-style.md#design-tokens-over-hardcoded-values).
 */
export default function TagPill({ name, colorHex }: Props) {
  if (!colorHex) {
    return (
      <span className="inline-flex w-fit items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-caption font-medium text-muted-foreground">
        {name}
      </span>
    );
  }

  return (
    <span
      className="inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-caption font-medium"
      style={{ backgroundColor: `${colorHex}1a`, color: colorHex }}
    >
      {name}
    </span>
  );
}
