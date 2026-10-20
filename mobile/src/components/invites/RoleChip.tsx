import { useTranslation } from 'react-i18next';

import { Chip } from '@/components/Chip';

import { parseCoachRoles } from './format';

type RoleChipProps = {
  /** The role string the API sends, such as "Nutritionist" or "Trainer & Nutritionist". */
  coachRole: string | undefined;
};

/** Role pill: green for a nutritionist, orange when the coach also trains. */
export function RoleChip({ coachRole }: RoleChipProps) {
  const { t } = useTranslation();
  const roles = parseCoachRoles(coachRole);
  if (roles.length === 0) return null;

  const label = roles.map((role) => t(`invites.roles.${role}`)).join(t('invites.roleJoiner'));
  return <Chip label={label} variant={roles.includes('Trainer') ? 'training' : 'nutrition'} />;
}
