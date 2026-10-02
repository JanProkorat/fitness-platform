import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';

interface Props {
  isOwnedByCurrentUser?: boolean;
  isSystem?: boolean;
}

/**
 * The "Library" column badge shared by the Ingredients and Recipes tables —
 * System / Mine / Shared. `isSystem` takes priority: a system entry is never
 * also "owned" by the caller.
 */
export default function LibraryBadge({ isOwnedByCurrentUser, isSystem }: Props) {
  const { t } = useTranslation();
  const labelKey = isSystem
    ? 'library.badge.system'
    : isOwnedByCurrentUser
      ? 'library.badge.mine'
      : 'library.badge.shared';
  return <Badge variant="library">{t(labelKey)}</Badge>;
}
