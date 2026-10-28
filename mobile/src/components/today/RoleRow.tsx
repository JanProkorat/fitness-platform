import { Pressable, StyleSheet, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { useTranslation } from 'react-i18next';

import { Text } from '@/components/Text';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

import type { CoachRole } from './collaborationRoles';
import { roleLook } from './roleLook';

type RoleRowProps = {
  role: CoachRole;
  /** "find" when the client has no coach at all, "add" next to an existing one. */
  mode: 'find' | 'add';
  onPress: () => void;
};

/** Full-width "Find / Add a <role>" row that opens the coach search for that role. */
export function RoleRow({ role, mode, onPress }: RoleRowProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const styles = makeStyles(theme);
  const look = roleLook(theme, role);
  const title = t(`today.row.${mode}.${role}`);
  const hint = t(role === 'Trainer' ? 'today.findCoach.trainer.hint' : 'today.findCoach.nutritionist.hint');

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${hint}`}
      onPress={onPress}
      style={styles.row}
    >
      <View style={[styles.icon, { backgroundColor: look.soft }]}>
        <SymbolView name={look.symbol} tintColor={look.ink} size={theme.sizes.coachGlyph} />
      </View>
      <View style={styles.copy}>
        <Text variant="subtitle">{title}</Text>
        <Text variant="caption" color="muted">
          {hint}
        </Text>
      </View>
      <SymbolView
        name="chevron.right"
        tintColor={theme.colors.muted}
        size={theme.sizes.coachChevron}
      />
    </Pressable>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.md,
      padding: theme.spacing.lg,
      borderRadius: theme.radii.xl,
      borderWidth: theme.sizes.border,
      borderColor: theme.colors.line,
      backgroundColor: theme.colors.surface,
      boxShadow: theme.shadows.card,
    },
    icon: {
      width: theme.sizes.coachIcon,
      height: theme.sizes.coachIcon,
      borderRadius: theme.radii.pill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    copy: {
      flex: 1,
      minWidth: 0,
      gap: theme.spacing.xxs / 2,
    },
  });
