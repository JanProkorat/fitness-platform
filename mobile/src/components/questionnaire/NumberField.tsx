import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { useTranslation } from 'react-i18next';

import { Text } from '@/components/Text';
import { inRange, parseDecimal, roundValue } from '@/components/questionnaire/fillModel';
import type { FillQuestion } from '@/components/questionnaire/fillModel';
import type { FieldProps } from '@/components/questionnaire/fieldProps';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

const NUMBER_MAX_LENGTH = 12;

/** The line that tells the client what range a number may be in. */
export function numberHintKey(question: FillQuestion): string | null {
  if (question.min !== null && question.max !== null) return 'questionnaireFill.number.range';
  if (question.min !== null) return 'questionnaireFill.number.atLeast';
  if (question.max !== null) return 'questionnaireFill.number.atMost';
  return null;
}

/** number: a typed value with an optional unit, and minus and plus buttons that step it. */
export function NumberField({ question, draft, onChange }: FieldProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const styles = makeStyles(theme);
  const value = parseDecimal(draft.text);
  const invalid = value === undefined || (typeof value === 'number' && !inRange(question, value));
  const hintKey = numberHintKey(question);

  const stepBy = (direction: 1 | -1) => {
    let next = typeof value === 'number' ? roundValue(value + direction * question.step) : (question.min ?? 0);
    if (question.min !== null) next = Math.max(question.min, next);
    if (question.max !== null) next = Math.min(question.max, next);
    onChange({ text: String(next) });
  };

  const canDecrease = typeof value === 'number' ? question.min === null || value > question.min : true;
  const canIncrease = typeof value === 'number' ? question.max === null || value < question.max : true;

  return (
    <View style={styles.root}>
      <View style={styles.row}>
        <View style={[styles.field, invalid && styles.fieldInvalid]}>
          <TextInput
            accessibilityLabel={question.label}
            value={draft.text}
            onChangeText={(text) => onChange({ text })}
            keyboardType={question.integer ? 'number-pad' : 'decimal-pad'}
            maxLength={NUMBER_MAX_LENGTH}
            placeholder={t('questionnaireFill.number.placeholder')}
            placeholderTextColor={theme.colors.muted}
            selectionColor={theme.colors.accent}
            style={styles.input}
          />
          {question.unit ? (
            <Text variant="body" color="muted">
              {question.unit}
            </Text>
          ) : null}
        </View>
        <StepButton
          symbol="minus"
          label={t('questionnaireFill.number.decrease', { field: question.label })}
          disabled={!canDecrease}
          onPress={() => stepBy(-1)}
        />
        <StepButton
          symbol="plus"
          label={t('questionnaireFill.number.increase', { field: question.label })}
          disabled={!canIncrease}
          onPress={() => stepBy(1)}
        />
      </View>
      {hintKey ? (
        <Text
          variant="caption"
          color={invalid ? 'error' : 'muted'}
          accessibilityRole={invalid ? 'alert' : undefined}
        >
          {t(hintKey, { min: question.min, max: question.max })}
        </Text>
      ) : null}
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
    root: {
      gap: theme.spacing.xs,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.xs,
    },
    field: {
      flex: 1,
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.xs,
      height: theme.sizes.field,
      paddingHorizontal: theme.spacing.lg,
      borderRadius: theme.radii.field,
      borderWidth: theme.sizes.border,
      borderColor: theme.colors.fieldBorder,
      backgroundColor: theme.colors.field,
    },
    fieldInvalid: {
      borderColor: theme.colors.error,
    },
    input: {
      ...theme.typography.numeral,
      flex: 1,
      minWidth: 0,
      padding: 0,
      color: theme.colors.ink,
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
