import { Pressable, StyleSheet, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import type { SFSymbol } from 'expo-symbols';

import { Text } from '@/components/Text';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

export type GetReadyAction = {
  label: string;
  onPress: () => void;
  /** Filled dark button (payments, photos) or an outlined one. */
  tone: 'primary' | 'secondary';
  symbol?: SFSymbol;
};

type GetReadyRowProps = {
  done: boolean;
  title: string;
  hint?: string;
  /** Hidden once the row is done. */
  action?: GetReadyAction;
};

/** One Get ready line: a status dot, what to do and, while open, its action. */
export function GetReadyRow({ done, title, hint, action }: GetReadyRowProps) {
  const theme = useTheme();
  const styles = makeStyles(theme);
  const primary = action?.tone === 'primary';

  return (
    <View style={styles.row} accessibilityLabel={done ? title : undefined}>
      {done ? (
        <View style={[styles.dot, styles.dotDone]}>
          <SymbolView name="checkmark" tintColor={theme.colors.onNutrition} size={theme.sizes.stepDotGlyph} />
        </View>
      ) : (
        <View style={[styles.dot, styles.dotOpen]} />
      )}
      <View style={styles.copy}>
        <Text variant={done ? 'bodySmall' : 'link'} color={done ? 'muted' : 'ink'}>
          {title}
        </Text>
        {hint && !done ? (
          <Text variant="caption" color="muted">
            {hint}
          </Text>
        ) : null}
      </View>
      {action && !done ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={action.label}
          onPress={action.onPress}
          style={[styles.action, primary ? styles.actionPrimary : null]}
        >
          {action.symbol ? (
            <SymbolView
              name={action.symbol}
              tintColor={primary ? theme.colors.onPrimary : theme.colors.ink}
              size={theme.sizes.rowGlyph}
            />
          ) : null}
          <Text variant="labelStrong" color={primary ? 'onPrimary' : 'ink'}>
            {action.label}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.md,
    },
    dot: {
      width: theme.sizes.stepDot,
      height: theme.sizes.stepDot,
      borderRadius: theme.radii.pill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dotDone: {
      backgroundColor: theme.colors.nutrition,
    },
    dotOpen: {
      borderWidth: theme.sizes.stepLine,
      borderColor: theme.colors.stepRing,
    },
    copy: {
      flex: 1,
      minWidth: 0,
      gap: theme.spacing.xxs / 2,
    },
    action: {
      height: theme.sizes.stepAction,
      paddingHorizontal: theme.spacing.lg,
      borderRadius: theme.radii.pill,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: theme.spacing.xs,
      borderWidth: theme.sizes.border,
      borderColor: theme.colors.lineStrong,
      backgroundColor: theme.colors.surface,
    },
    actionPrimary: {
      borderColor: theme.colors.primary,
      backgroundColor: theme.colors.primary,
    },
  });
