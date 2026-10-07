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
  const [labelKey, variant] = isSystem
    ? (['library.badge.system', 'library-system'] as const)
    : isOwnedByCurrentUser
      ? (['library.badge.mine', 'library-mine'] as const)
      : (['library.badge.shared', 'library-shared'] as const);
  return <Badge variant={variant}>{t(labelKey)}</Badge>;
}
