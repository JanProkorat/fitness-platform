import type { ClientTagSummaryDto } from '@/api/generated';
import TagPill from '@/components/tags/TagPill';

interface Props {
  tag: ClientTagSummaryDto;
}

/** Thin adapter over the generalised `TagPill` (#1120) — see that component
 * for the shared rendering logic. */
export default function ClientTagPill({ tag }: Props) {
  return <TagPill name={tag.name ?? ''} colorHex={tag.colorHex} />;
}
