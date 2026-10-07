import { cn } from '@/lib/utils';

interface Props {
  name: string;
  colorHex?: string | null;
  /** `table` is the squarer, semibold pill used on the library tables. */
  variant?: 'default' | 'table';
}

/**
 * Generalised coloured tag chip, shared by client tags and food tags (#1120)
 * — see `ClientTagPill`/`FoodTagLookup` call sites. A tag's `colorHex` is
 * per-coach runtime data chosen in the tag editor, not a design token — the
 * inline `style` here is the code-style rule's own carve-out for a value
 * that genuinely can't be expressed as a static class
 * (rules/code-style.md#design-tokens-over-hardcoded-values).
 */
export default function TagPill({ name, colorHex, variant = 'default' }: Props) {
  const shape =
    variant === 'table'
      ? 'rounded-sm px-2.5 py-1 text-meta font-semibold'
      : 'rounded-full px-2 py-0.5 text-caption font-medium';

  if (!colorHex) {
    return (
      <span className={cn('inline-flex w-fit items-center gap-1 bg-muted text-muted-foreground', shape)}>
        {name}
      </span>
    );
  }

  return (
    <span
      className={cn('inline-flex w-fit items-center gap-1', shape)}
      style={{ backgroundColor: `${colorHex}1a`, color: colorHex }}
    >
      {name}
    </span>
  );
}
