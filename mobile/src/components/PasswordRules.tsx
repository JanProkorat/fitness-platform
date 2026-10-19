import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { SymbolView } from 'expo-symbols';

import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

import { Text } from './Text';

export const PASSWORD_MIN_LENGTH = 8;

export type PasswordRuleKey = 'length' | 'uppercase' | 'lowercase' | 'digit';

const RULES: { key: PasswordRuleKey; test: (password: string) => boolean }[] = [
  { key: 'length', test: (password) => password.length >= PASSWORD_MIN_LENGTH },
  { key: 'uppercase', test: (password) => /\p{Lu}/u.test(password) },
  { key: 'lowercase', test: (password) => /\p{Ll}/u.test(password) },
  { key: 'digit', test: (password) => /\d/.test(password) },
];

/** True when the password satisfies every rule the backend enforces. */
export function passwordMeetsRules(password: string): boolean {
  return RULES.every((rule) => rule.test(password));
}

/** Live checklist of the password rules. */
export function PasswordRules({ password }: { password: string }) {
  const theme = useTheme();
  const { t } = useTranslation();
  const styles = makeStyles(theme);

  return (
    <View style={styles.grid}>
      {RULES.map(({ key, test }) => {
        const met = test(password);
        return (
          <View
            key={key}
            accessible
            accessibilityLabel={t(`auth.register.passwordRules.${key}`)}
            accessibilityValue={{ text: met ? t('auth.register.ruleMet') : t('auth.register.ruleUnmet') }}
            style={styles.rule}
          >
            <View style={[styles.dot, met ? styles.dotMet : styles.dotUnmet]}>
              {met ? (
                <SymbolView
                  name="checkmark"
                  weight="heavy"
                  tintColor={theme.colors.onNutrition}
                  size={theme.sizes.ruleGlyph}
                />
              ) : null}
            </View>
            <Text variant="caption" color={met ? 'ink2' : 'muted'}>
              {t(`auth.register.passwordRules.${key}`)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      columnGap: theme.spacing.sm,
      rowGap: theme.spacing.snug,
    },
    rule: {
      flexBasis: '48%',
      flexGrow: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.xs,
    },
    dot: {
      width: theme.sizes.ruleDot,
      height: theme.sizes.ruleDot,
      borderRadius: theme.radii.pill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dotMet: {
      backgroundColor: theme.colors.nutrition,
    },
    dotUnmet: {
      borderWidth: theme.sizes.border,
      borderColor: theme.colors.fieldBorder,
    },
  });
