import { useTranslation } from 'react-i18next';

import { ROLE_NUTRITIONIST } from '@/api/profile';
import type { CoachRole } from '@/api/professionals';
import { Chip } from '@/components/Chip';

type CoachRoleChipProps = {
  role: CoachRole;
};

/** "Trainer" (orange) or "Nutritionist" (green) tag. */
export function CoachRoleChip({ role }: CoachRoleChipProps) {
  const { t } = useTranslation();
  return (
    <Chip
      label={t(`coachSearch.roles.${role}`)}
      variant={role === ROLE_NUTRITIONIST ? 'nutrition' : 'training'}
    />
  );
}
