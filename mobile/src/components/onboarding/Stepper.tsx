import { Pressable, StyleSheet, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { useTranslation } from 'react-i18next';

import { OptionalPill } from '@/components/onboarding/OptionalPill';
import { Text } from '@/components/Text';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

type StepperProps = {
  label: string;
  /** The formatted value, or `null` to show the "not set" state. */
  display: string | null;
  unit: string;
  canDecrease: boolean;
  canIncrease: boolean;
  onDecrease: () => void;
  onIncrease: () => void;
  optional?: boolean;
};

/** A labelled number with round minus and plus buttons. */
export function Stepper({
  label,
  display,
  unit,
  canDecrease,
  canIncrease,
  onDecrease,
  onIncrease,
  optional = false,
}: StepperProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const styles = makeStyles(theme);

  return (
    <View style={styles.row}>
      <View style={styles.copy}>
        <Text variant="label" color="muted">
          {label}
        </Text>
        <View
          accessible
          accessibilityLabel={`${label}: ${display === null ? t('onboarding.notSet') : `${display} ${unit}`}`}
          style={styles.value}
        >
          {display === null ? (
            <Text variant="bodyLarge" color="muted" style={styles.notSet}>
              {t('onboarding.notSet')}
            </Text>
          ) : (
            <>
              <Text variant="numeral">{display}</Text>
              <Text variant="body" color="muted">
                {unit}
              </Text>
            </>
          )}
        </View>
      </View>
      {optional ? <OptionalPill /> : null}
      <StepButton
        symbol="minus"
        label={t('onboarding.decrease', { field: label })}
        disabled={!canDecrease}
        onPress={onDecrease}
      />
      <StepButton
        symbol="plus"
        label={t('onboarding.increase', { field: label })}
        disabled={!canIncrease}
        onPress={onIncrease}
      />
    </View>
  );
}

type StepButtonProps = {
  symbol: 'minus' | 'plus';
  label: string;
  disabled: boolean;
  onPress: () => void;
};

function StepButton({ symbol, label, disabled, onPress }: StepButtonProps) {
  const theme = useTheme();
  const styles = makeStyles(theme);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      hitSlop={theme.spacing.xxs}
      onPress={onPress}
      style={[styles.button, disabled && styles.buttonDisabled]}
    >
      <SymbolView
        name={symbol}
        weight="medium"
        tintColor={theme.colors.ink}
        size={theme.sizes.stepGlyph}
      />
    </Pressable>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.xs,
    },
    copy: {
      flex: 1,
      minWidth: 0,
    },
    value: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: theme.spacing.xxs,
      minHeight: theme.typography.numeral.lineHeight,
    },
    notSet: {
      alignSelf: 'center',
    },
    button: {
      width: theme.sizes.stepButton,
      height: theme.sizes.stepButton,
      borderRadius: theme.radii.pill,
      borderWidth: theme.sizes.border,
      borderColor: theme.colors.lineStrong,
      alignItems: 'center',
      justifyContent: 'center',
    },
    buttonDisabled: {
      opacity: theme.opacity.disabled,
    },
  });
