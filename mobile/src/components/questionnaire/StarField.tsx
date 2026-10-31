import { Pressable, StyleSheet, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { useTranslation } from 'react-i18next';

import { Text } from '@/components/Text';
import { RATING_MAX } from '@/components/questionnaire/fillModel';
import type { FieldProps } from '@/components/questionnaire/fieldProps';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

const STARS = Array.from({ length: RATING_MAX }, (_, index) => index + 1);

/** The filled and empty stars for a value; also used on the review screen. */
export function Stars({ value, size, color }: { value: number | null; size: number; color: string }) {
  return (
    <>
      {STARS.map((star) => (
        <SymbolView
          key={star}
          name={value !== null && star <= value ? 'star.fill' : 'star'}
          tintColor={color}
          size={size}
        />
      ))}
    </>
  );
}

/** star_rating: five tappable stars with the value spelled out beside them. */
export function StarField({ question, draft, onChange }: FieldProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const styles = makeStyles(theme);

  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={question.label} style={styles.row}>
      <View style={styles.stars}>
        {STARS.map((star) => {
          const filled = draft.number !== null && star <= draft.number;
          return (
            <Pressable
              key={star}
              accessibilityRole="radio"
              accessibilityLabel={t('questionnaireFill.rating.ofMax', { value: star, max: RATING_MAX })}
              accessibilityState={{ selected: draft.number === star }}
              onPress={() => onChange({ number: star })}
              style={styles.star}
            >
              <SymbolView
                name={filled ? 'star.fill' : 'star'}
                tintColor={filled ? theme.colors.trainingInk : theme.colors.muted}
                size={theme.sizes.paymentGlyph + theme.spacing.xxs}
              />
            </Pressable>
          );
        })}
      </View>
      {draft.number !== null ? (
        <Text variant="bodyStrong">{t('questionnaireFill.rating.ofMax', { value: draft.number, max: RATING_MAX })}</Text>
      ) : null}
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    stars: {
      flexDirection: 'row',
    },
    star: {
      width: theme.sizes.mealTouch,
      height: theme.sizes.mealTouch,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
