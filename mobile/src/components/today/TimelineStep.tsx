import { Pressable, StyleSheet, View } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { Text } from '@/components/Text';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

export type StepState = 'done' | 'open' | 'current';

type TimelineStepProps = {
  state: StepState;
  title: string;
  hint?: string;
  /** Ring and core colour of a current step. */
  currentColor?: string;
  /** Trailing action button; a step without one is informational. */
  actionLabel?: string;
  onAction?: () => void;
  /** Filled for the step's main call to action, outlined otherwise. */
  actionTone?: 'primary' | 'secondary';
  /** Connector to the next step: null for the last step, otherwise whether it is already travelled. */
  connector: 'done' | 'idle' | null;
};

/** One row of the coach progress timeline: a status dot, a connector line, text and an optional action. */
export function TimelineStep({
  state,
  title,
  hint,
  currentColor,
  actionLabel,
  onAction,
  actionTone = 'secondary',
  connector,
}: TimelineStepProps) {
  const theme = useTheme();
  const styles = makeStyles(theme);
  const ring = currentColor ?? theme.colors.ink;

  return (
    <View style={styles.row}>
      <View style={styles.rail}>
        {state === 'done' ? (
          <View style={[styles.dot, styles.dotDone]}>
            <SymbolView name="checkmark" tintColor={theme.colors.onNutrition} size={theme.sizes.stepDotGlyph} />
          </View>
        ) : state === 'current' ? (
          <View style={[styles.dot, styles.dotRing, { borderColor: ring }]}>
            <View style={[styles.core, { backgroundColor: ring }]} />
          </View>
        ) : (
          <View style={[styles.dot, styles.dotRing, { borderColor: theme.colors.stepRing }]} />
        )}
        {connector ? (
          <View
            style={[
              styles.line,
              { backgroundColor: connector === 'done' ? theme.colors.nutrition : theme.colors.stepLine },
            ]}
          />
        ) : null}
      </View>
      <View style={[styles.copy, connector ? styles.copyGap : null]}>
        <Text variant={state === 'done' ? 'bodySmall' : 'link'} color={state === 'done' ? 'muted' : 'ink'}>
          {title}
        </Text>
        {hint ? (
          <Text variant="caption" color="muted">
            {hint}
          </Text>
        ) : null}
      </View>
      {actionLabel && onAction ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          onPress={onAction}
          style={[styles.action, actionTone === 'primary' ? styles.actionPrimary : null]}
        >
          <Text variant="labelStrong" color={actionTone === 'primary' ? 'onPrimary' : 'ink'}>
            {actionLabel}
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
      alignItems: 'flex-start',
      gap: theme.spacing.md,
    },
    rail: {
      alignSelf: 'stretch',
      alignItems: 'center',
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
    dotRing: {
      borderWidth: theme.sizes.stepLine,
    },
    core: {
      width: theme.sizes.stepDotCore,
      height: theme.sizes.stepDotCore,
      borderRadius: theme.radii.pill,
    },
    line: {
      flex: 1,
      width: theme.sizes.stepLine,
      minHeight: theme.spacing.xs,
    },
    copy: {
      flex: 1,
      minWidth: 0,
      gap: theme.spacing.xxs / 2,
      paddingTop: theme.spacing.xxs / 2,
    },
    copyGap: {
      paddingBottom: theme.spacing.xs,
    },
    action: {
      height: theme.sizes.stepAction,
      paddingHorizontal: theme.spacing.lg,
      borderRadius: theme.radii.pill,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: theme.sizes.border,
      borderColor: theme.colors.lineStrong,
      backgroundColor: theme.colors.surface,
    },
    actionPrimary: {
      borderColor: theme.colors.primary,
      backgroundColor: theme.colors.primary,
    },
  });
