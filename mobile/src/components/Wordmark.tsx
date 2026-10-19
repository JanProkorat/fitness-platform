import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { LogoMark } from '@/components/LogoMark';
import { sizes, useTheme } from '@/theme';

/** Form Up wordmark: the checklist mark stands in for the F. */
export function Wordmark() {
  const theme = useTheme();
  const { t } = useTranslation();
  const { colors } = theme;

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={t('launch.label')}
      style={styles.row}
    >
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={styles.mark}
      >
        <LogoMark
          width={sizes.wordmarkMarkWidth}
          height={sizes.wordmarkMarkHeight}
          palette={{
            top: colors.wordmarkMarkTop,
            bottom: colors.wordmarkMarkBottom,
            ring: colors.launchRing,
            tick: colors.onAccent,
          }}
        />
      </View>
      <Text numberOfLines={1} style={[theme.typography.wordmark, { color: colors.wordmarkInk }]}>
        ORM <Text style={{ color: colors.wordmarkAccent }}>UP</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  mark: {
    marginRight: sizes.wordmarkMarkGap,
  },
});
