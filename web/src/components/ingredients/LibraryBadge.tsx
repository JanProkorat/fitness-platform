import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';

interface Props {
  isOwnedByCurrentUser?: boolean;
  isSystem?: boolean;
}

/**
 * Renders the ingredients table's "Library" column badge — System / Mine /
 * Shared (another coach's Public food). `FoodSummary.isSystem` (true when the
 * food has no owning nutritionist — a platform system/catalog entry) plus
 * `isOwnedByCurrentUser` are enough to derive all three states without
 * exposing the owning nutritionist's id (see `Features/Foods/Shared/FoodSummary.cs`'s
 * `IsSystem` doc comment). `isSystem` takes priority: a system food is never
 * also "owned" by the caller.
 */
export default function LibraryBadge({ isOwnedByCurrentUser, isSystem }: Props) {
  const { t } = useTranslation();
  const labelKey = isSystem
    ? 'ingredients.library.system'
    : isOwnedByCurrentUser
      ? 'ingredients.library.mine'
      : 'ingredients.library.shared';
  return <Badge variant="secondary">{t(labelKey)}</Badge>;
}
