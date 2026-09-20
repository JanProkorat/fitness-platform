import type { ClientTagSummaryDto } from '@/api/generated';

interface Props {
  tag: ClientTagSummaryDto;
}

/**
 * A tag's `colorHex` is a per-coach runtime value chosen in the (phase-4)
 * tag editor, not a design token — the inline `style` here is the code-style
 * rule's own carve-out for a value that genuinely can't be expressed as a
 * static class (rules/code-style.md#design-tokens-over-hardcoded-values).
 */
export default function ClientTagPill({ tag }: Props) {
  if (!tag.colorHex) {
    return (
      <span className="inline-flex w-fit items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-caption font-medium text-muted-foreground">
        {tag.name}
      </span>
    );
  }

  return (
    <span
      className="inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-caption font-medium"
      style={{ backgroundColor: `${tag.colorHex}1a`, color: tag.colorHex }}
    >
      {tag.name}
    </span>
  );
}
