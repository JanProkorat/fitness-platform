import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { useTranslation } from 'react-i18next';

import { RatingEnds } from '@/components/onboarding/RatingEnds';
import { RATING_MAX } from '@/components/questionnaire/fillModel';
import type { FieldProps } from '@/components/questionnaire/fieldProps';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

/** Mouth of each face on a 24-unit grid, saddest to happiest. */
const MOUTHS = [
  'M7.5 17 Q12 12.5 16.5 17',
  'M8.5 16.5 Q12 14 15.5 16.5',
  'M8.5 15.5 L15.5 15.5',
  'M8.5 14 Q12 17 15.5 14',
  'M7.5 13.5 Q12 19 16.5 13.5',
] as const;

/** smiley_rating: five faces from sad to happy. */
export function SmileyField({ question, draft, onChange }: FieldProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const styles = makeStyles(theme);

  return (
    <View>
      <View accessibilityRole="radiogroup" accessibilityLabel={question.label} style={styles.row}>
        {MOUTHS.map((mouth, index) => {
          const value = index + 1;
          const selected = draft.number === value;
          const color = selected ? theme.colors.ink : theme.colors.muted;
          return (
            <Pressable
              key={mouth}
              accessibilityRole="radio"
              accessibilityLabel={t('questionnaireFill.rating.ofMax', { value, max: RATING_MAX })}
              accessibilityState={{ selected }}
              onPress={() => onChange({ number: value })}
              style={[styles.face, selected && styles.faceSelected]}
            >
              <Svg viewBox="0 0 24 24" style={styles.glyph}>
                <Circle cx={12} cy={12} r={10} stroke={color} strokeWidth={1.6} fill="none" />
                <Circle cx={8.5} cy={10} r={1.1} fill={color} />
                <Circle cx={15.5} cy={10} r={1.1} fill={color} />
                <Path d={mouth} stroke={color} strokeWidth={1.6} strokeLinecap="round" fill="none" />
              </Svg>
            </Pressable>
          );
        })}
      </View>
      {question.lowLabel || question.highLabel ? (
        <RatingEnds low={question.lowLabel ?? ''} high={question.highLabel ?? ''} />
      ) : null}
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      gap: theme.spacing.xs,
    },
    face: {
      flex: 1,
      aspectRatio: 1,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: theme.radii.pill,
      borderWidth: theme.sizes.border,
      borderColor: theme.colors.lineStrong,
      backgroundColor: theme.colors.surface,
    },
    faceSelected: {
      borderWidth: theme.sizes.borderStrong,
      borderColor: theme.colors.primary,
    },
    glyph: {
      width: '62%',
      height: '62%',
    },
  });
