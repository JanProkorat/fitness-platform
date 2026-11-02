import { Pressable, StyleSheet, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { useTranslation } from 'react-i18next';

import { coachFullName, coachRoles } from '@/api/professionals';
import type { CoachSummary } from '@/api/professionals';
import { Text } from '@/components/Text';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

import { CoachAvailability } from './CoachAvailability';
import { CoachAvatar } from './CoachAvatar';
import { CoachRoleChip } from './CoachRoleChip';

/** Specialty pills shown on a card before the rest collapse into "+N". */
const VISIBLE_SPECIALTIES = 2;

type CoachCardProps = {
  coach: CoachSummary;
  onPress: () => void;
  /** Show one role chip per role the coach holds. */
  showRoles: boolean;
};

/** One search result card: photo, name and roles, where they work, availability and specialties. */
export function CoachCard({ coach, onPress, showRoles }: CoachCardProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const styles = makeStyles(theme);
  const roles = showRoles ? coachRoles(coach.roles) : [];
  const where = [coach.city, coach.online ? t('coachSearch.online') : undefined]
    .filter(Boolean)
    .join(' · ');
  const specialties = coach.specializations ?? [];
  const shown = specialties.slice(0, VISIBLE_SPECIALTIES);
  const hidden = specialties.length - shown.length;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={coachFullName(coach)}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.header}>
        <CoachAvatar coach={coach} size={theme.sizes.coachCardAvatar} />
        <View style={styles.identity}>
          <Text variant="subtitle" numberOfLines={1}>
            {coachFullName(coach)}
          </Text>
          {roles.length > 0 ? (
            <View style={styles.roles}>
              {roles.map((role) => (
                <CoachRoleChip key={role} role={role} size="sm" />
              ))}
            </View>
          ) : null}
        </View>
        <SymbolView
          name="chevron.right"
          tintColor={theme.colors.muted}
          size={theme.sizes.coachCardChevron}
        />
      </View>
      <View style={styles.divider} />
      <View style={styles.details}>
        <View style={styles.meta}>
          <View style={styles.where}>
            {where ? (
              <>
                <SymbolView
                  name="mappin.and.ellipse"
                  tintColor={theme.colors.muted}
                  size={theme.sizes.coachCardPin}
                />
                <Text variant="label" color="muted" numberOfLines={1} style={styles.whereText}>
                  {where}
                </Text>
              </>
            ) : null}
          </View>
          <CoachAvailability acceptsNewClients={coach.acceptNewClients ?? false} />
        </View>
        {shown.length > 0 ? (
          <View style={styles.specialties}>
            {shown.map((value) => (
              <View key={value} style={styles.pill}>
                <Text variant="label" numberOfLines={1}>
                  {value}
                </Text>
              </View>
            ))}
            {hidden > 0 ? (
              <Text variant="labelStrong" color="muted">
                {`+${hidden}`}
              </Text>
            ) : null}
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    card: {
      gap: theme.spacing.md,
      paddingVertical: theme.spacing.lg,
      paddingHorizontal: theme.spacing.xl,
      borderRadius: theme.radii.card,
      borderWidth: theme.sizes.border,
      borderColor: theme.colors.line,
      backgroundColor: theme.colors.surface,
      boxShadow: theme.shadows.card,
    },
    pressed: {
      opacity: theme.opacity.pressedRow,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.md,
    },
    identity: {
      flex: 1,
      minWidth: 0,
      gap: theme.spacing.snug,
    },
    roles: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.spacing.snug,
    },
    divider: {
      height: theme.sizes.border,
      backgroundColor: theme.colors.line,
    },
    details: {
      gap: theme.spacing.sm,
    },
    meta: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: theme.spacing.md,
    },
    where: {
      flex: 1,
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.xxs,
    },
    whereText: {
      flexShrink: 1,
    },
    specialties: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: theme.spacing.xs,
    },
    pill: {
      paddingVertical: theme.spacing.snug,
      paddingHorizontal: theme.spacing.md,
      borderRadius: theme.radii.pill,
      backgroundColor: theme.colors.subtle,
    },
  });
