import { Pressable, StyleSheet, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { useTranslation } from 'react-i18next';

import { coachFullName, primaryRole } from '@/api/professionals';
import type { CoachSummary } from '@/api/professionals';
import { Text } from '@/components/Text';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

import { CoachAvailability } from './CoachAvailability';
import { CoachAvatar } from './CoachAvatar';
import { CoachRoleChip } from './CoachRoleChip';

type CoachRowProps = {
  coach: CoachSummary;
  onPress: () => void;
};

/** One search result: photo, name and role, where they work, specialties and availability. */
export function CoachRow({ coach, onPress }: CoachRowProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const styles = makeStyles(theme);
  const role = primaryRole(coach.roles);
  const where = [coach.city, coach.online ? t('coachSearch.online') : undefined]
    .filter(Boolean)
    .join(' · ');
  const specialties = (coach.specializations ?? []).join(', ');

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={coachFullName(coach)}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <CoachAvatar coach={coach} size={theme.sizes.coachAvatar} />
      <View style={styles.body}>
        <View style={styles.nameRow}>
          <Text variant="subtitle" numberOfLines={1} style={styles.name}>
            {coachFullName(coach)}
          </Text>
          {role ? <CoachRoleChip role={role} /> : null}
        </View>
        {where ? (
          <View style={styles.where}>
            <SymbolView name="mappin.and.ellipse" tintColor={theme.colors.muted} size={theme.sizes.coachChevron} />
            <Text variant="bodySmall" color="muted" numberOfLines={1} style={styles.name}>
              {where}
            </Text>
          </View>
        ) : null}
        {specialties ? (
          <Text variant="bodySmall" numberOfLines={2}>
            {specialties}
          </Text>
        ) : null}
        <CoachAvailability acceptsNewClients={coach.acceptNewClients ?? false} />
      </View>
      <SymbolView name="chevron.right" tintColor={theme.colors.muted} size={theme.sizes.coachChevron} />
    </Pressable>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.lg,
      paddingVertical: theme.spacing.lg,
      borderBottomWidth: theme.sizes.border,
      borderBottomColor: theme.colors.line,
    },
    pressed: {
      opacity: 0.7,
    },
    body: {
      flex: 1,
      minWidth: 0,
      gap: theme.spacing.xxs,
    },
    nameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.xs,
    },
    name: {
      flexShrink: 1,
    },
    where: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.xxs,
    },
  });
