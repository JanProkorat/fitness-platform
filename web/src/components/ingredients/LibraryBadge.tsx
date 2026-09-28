import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';

interface Props {
  isOwnedByCurrentUser?: boolean;
}

/**
 * Renders the ingredients table's "Library" column badge.
 *
 * Design contract (`docs/design/ingredients/inventory.md`, design-review
 * finding #6) calls for three states — System / Mine / Shared (another
 * coach's Public food) — but `FoodSummary` (the backend response DTO) only
 * ever carries `isOwnedByCurrentUser`; it does not expose the owning
 * nutritionist's id or a system/shared distinction (see
 * `Features/Foods/Shared/FoodSummary.cs`). A row this coach doesn't own is
 * therefore indistinguishable, from the wire, between "seeded system food"
 * and "another coach's shared food" — both render as "System" here, matching
 * every sample row in the wireframe (`ingredients-01.png`/`ingredients-02.png`,
 * whose only observed Library value is "System"). Rendering the third state
 * needs a backend contract change (out of scope for `web-react` — see
 * `rules/scope-boundaries.md#package-boundary-rule`).
 */
export default function LibraryBadge({ isOwnedByCurrentUser }: Props) {
  const { t } = useTranslation();
  return <Badge variant="secondary">{t(isOwnedByCurrentUser ? 'ingredients.library.mine' : 'ingredients.library.system')}</Badge>;
}
