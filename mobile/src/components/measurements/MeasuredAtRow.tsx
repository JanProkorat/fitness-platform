import { useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { SymbolView } from 'expo-symbols';
import { useTranslation } from 'react-i18next';
import Animated, { FadeInUp, FadeOutUp, ReduceMotion } from 'react-native-reanimated';

import { Text } from '@/components/Text';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';
import { measuredAtPickerMotion } from '@/theme/motion';

import { measuredAtLabel } from './format';

type MeasuredAtRowProps = {
  value: Date;
  onChange: (value: Date) => void;
};

/** Caps a picked moment at now, so a measurement is never dated in the future. */
const notAfterNow = (picked: Date): Date => {
  const now = new Date();
  return picked.getTime() > now.getTime() ? now : picked;
};

/** Row showing when the measurement was taken; opens the platform date and time picker. */
export function MeasuredAtRow({ value, onChange }: MeasuredAtRowProps) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const styles = makeStyles(theme);
  const [expanded, setExpanded] = useState(false);
  const [now] = useState(() => Date.now());
  const label = measuredAtLabel(t, i18n.language, value, now);

  const openAndroid = () => {
    DateTimePickerAndroid.open({
      value,
      mode: 'date',
      maximumDate: new Date(),
      onValueChange: (_event, pickedDay) => {
        const day = new Date(value);
        day.setFullYear(pickedDay.getFullYear(), pickedDay.getMonth(), pickedDay.getDate());
        DateTimePickerAndroid.open({
          value: day,
          mode: 'time',
          is24Hour: true,
          onValueChange: (_timeEvent, pickedTime) => {
            const merged = new Date(day);
            merged.setHours(pickedTime.getHours(), pickedTime.getMinutes(), 0, 0);
            onChange(notAfterNow(merged));
          },
        });
      },
    });
  };

  const toggle = () => {
    if (Platform.OS === 'android') openAndroid();
    else setExpanded((open) => !open);
  };

  return (
    <View style={styles.root}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('measurements.sheet.measuredA11y', { value: label })}
        onPress={toggle}
        style={styles.row}
      >
        <SymbolView name="calendar" tintColor={theme.colors.ink} size={theme.sizes.fieldIcon} />
        <Text variant="body">{t('measurements.sheet.measured')}</Text>
        <Text variant="body" color="muted" style={styles.value}>
          {label}
        </Text>
        <SymbolView
          name={expanded ? 'chevron.down' : 'chevron.right'}
          weight="medium"
          tintColor={theme.colors.muted}
          size={theme.sizes.listChevron}
        />
      </Pressable>
      {expanded && Platform.OS === 'ios' ? (
        <Animated.View
          entering={FadeInUp.duration(measuredAtPickerMotion.enterDuration).reduceMotion(
            ReduceMotion.System,
          )}
          exiting={FadeOutUp.duration(measuredAtPickerMotion.exitDuration).reduceMotion(
            ReduceMotion.System,
          )}
        >
          <DateTimePicker
            value={value}
            mode="datetime"
            display="inline"
            maximumDate={new Date()}
            locale={i18n.language}
            themeVariant={theme.scheme}
            accentColor={theme.colors.accent}
            onValueChange={(_event, picked) => onChange(notAfterNow(picked))}
          />
        </Animated.View>
      ) : null}
    </View>
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
      gap: theme.spacing.sm,
      height: theme.sizes.field,
      paddingHorizontal: theme.spacing.xl,
      borderRadius: theme.radii.lg,
      borderWidth: theme.sizes.border,
      borderColor: theme.colors.line,
      backgroundColor: theme.colors.surface,
      boxShadow: theme.shadows.card,
    },
    value: {
      flex: 1,
      textAlign: 'right',
    },
  });
