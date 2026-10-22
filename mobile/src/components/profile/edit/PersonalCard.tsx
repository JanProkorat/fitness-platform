import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Input } from '@/components/Input';
import { OptionalPill } from '@/components/onboarding/OptionalPill';
import { ListCard } from '@/components/profile/ListCard';
import { Text } from '@/components/Text';
import { PERSONAL_LIMITS } from '@/hooks/useEditProfile';
import type { Personal, PersonalField } from '@/hooks/useEditProfile';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

type PersonalCardProps = {
  personal: Personal;
  /** Fields that fail the client-side check. */
  errors: Partial<Record<PersonalField, 'required'>>;
  /** True when the server flagged the (lower-cased) field name. */
  serverFlagged: (field: string) => boolean;
  onChange: (field: PersonalField, value: string) => void;
};

/** First name, last name and phone, the fields PUT /users/me saves. */
export function PersonalCard({ personal, errors, serverFlagged, onChange }: PersonalCardProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const styles = makeStyles(theme);

  return (
    <ListCard>
      <View style={styles.field}>
        <Input
          label={t('editProfile.firstName')}
          value={personal.firstName}
          onChangeText={(value) => onChange('firstName', value)}
          invalid={errors.firstName !== undefined || serverFlagged('firstName')}
          maxLength={PERSONAL_LIMITS.name}
          autoCapitalize="words"
          autoComplete="given-name"
          textContentType="givenName"
          returnKeyType="next"
        />
        {errors.firstName ? (
          <Text variant="label" color="error" accessibilityRole="alert">
            {t('editProfile.errors.required')}
          </Text>
        ) : null}
      </View>
      <View style={styles.field}>
        <Input
          label={t('editProfile.lastName')}
          value={personal.lastName}
          onChangeText={(value) => onChange('lastName', value)}
          invalid={errors.lastName !== undefined || serverFlagged('lastName')}
          maxLength={PERSONAL_LIMITS.name}
          autoCapitalize="words"
          autoComplete="family-name"
          textContentType="familyName"
          returnKeyType="next"
        />
        {errors.lastName ? (
          <Text variant="label" color="error" accessibilityRole="alert">
            {t('editProfile.errors.required')}
          </Text>
        ) : null}
      </View>
      <View style={styles.field}>
        <Input
          label={t('editProfile.phone')}
          value={personal.phone}
          onChangeText={(value) => onChange('phone', value)}
          invalid={serverFlagged('phoneNumber')}
          maxLength={PERSONAL_LIMITS.phone}
          placeholder={t('editProfile.phonePlaceholder')}
          keyboardType="phone-pad"
          autoComplete="tel"
          textContentType="telephoneNumber"
          returnKeyType="done"
          trailing={personal.phone.length === 0 ? <OptionalPill /> : undefined}
        />
      </View>
    </ListCard>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    field: {
      gap: theme.spacing.xxs,
      paddingVertical: theme.spacing.md,
    },
  });
