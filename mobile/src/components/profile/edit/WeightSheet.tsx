import { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import { LIMITS } from '@/api/onboarding';
import { isValidTargetWeight } from '@/api/onboardingAnswers';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { SheetFrame } from '@/components/profile/edit/SheetFrame';
import { Text } from '@/components/Text';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

type WeightSheetProps = {
  visible: boolean;
  /** The weight shown when the sheet opens, in kilograms. */
  value: number | null;
  onSave: (kg: number) => void;
  onClose: () => void;
};

/** Parses a typed weight; a comma counts as the decimal separator. Returns `NaN` for junk. */
const parseKg = (text: string): number => {
  const normalized = text.trim().replace(',', '.');
  return normalized.length === 0 ? Number.NaN : Math.round(Number(normalized) * 10) / 10;
};

/** Bottom sheet with one number field for the target weight. */
export function WeightSheet({ visible, ...rest }: WeightSheetProps) {
  // A fresh content tree per opening, so the field starts from the current value.
  return visible ? <OpenSheet {...rest} /> : null;
}

function OpenSheet({ value, onSave, onClose }: Omit<WeightSheetProps, 'visible'>) {
  const { t } = useTranslation();
  const theme = useTheme();
  const styles = makeStyles(theme);
  const [text, setText] = useState(value === null ? '' : String(value));

  const kg = parseKg(text);
  const valid = isValidTargetWeight(kg);
  const showError = text.trim().length > 0 && !valid;

  const submit = () => {
    if (!valid) return;
    onSave(kg);
    onClose();
  };

  return (
    <SheetFrame
      visible
      title={t('editProfile.info.targetWeight')}
      onClose={onClose}
      action={
        <Pressable
          accessibilityRole="button"
          hitSlop={theme.spacing.xs}
          onPress={onClose}
          style={styles.cancel}
        >
          <Text variant="body" color="muted">
            {t('editProfile.cancel')}
          </Text>
        </Pressable>
      }
    >
      <Input
        label={t('editProfile.weightLabel')}
        value={text}
        onChangeText={setText}
        invalid={showError}
        autoFocus
        keyboardType="decimal-pad"
        maxLength={5}
        returnKeyType="done"
        onSubmitEditing={submit}
        trailing={
          <Text variant="body" color="muted">
            {t('onboarding.basics.weightUnit')}
          </Text>
        }
      />
      {showError ? (
        <Text variant="label" color="error" accessibilityRole="alert">
          {t('editProfile.errors.weightRange', LIMITS.weightKg)}
        </Text>
      ) : null}
      <Button label={t('onboarding.sheet.done')} onPress={submit} disabled={!valid} />
    </SheetFrame>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    cancel: {
      paddingHorizontal: theme.spacing.xxs,
    },
  });
