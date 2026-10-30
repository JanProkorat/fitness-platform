import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { PendingMark } from '@/components/offline/PendingMark';
import { Sparkline } from '@/components/profile/Sparkline';
import { Text } from '@/components/Text';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

type MeasurementRowProps = {
  label: string;
  /** Muted line under the label, such as "−0.6 this month". */
  caption?: string;
  /** Green caption for a change in the good direction. */
  captionPositive?: boolean;
  /** The latest value was recorded offline and has not reached the server. */
  pending?: boolean;
  values: readonly number[];
  value: string;
};

/** One metric of the measurements list: label and trend, sparkline, latest value. */
export function MeasurementRow({
  label,
  caption,
  captionPositive = false,
  pending = false,
  values,
  value,
}: MeasurementRowProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const styles = makeStyles(theme);

  return (
    <View
      accessible
      accessibilityLabel={[label, value, pending ? t('offlineSync.pendingA11y') : caption].filter(Boolean).join(', ')}
      style={styles.row}
    >
      <View style={styles.copy}>
        <Text variant="body" numberOfLines={1}>
          {label}
        </Text>
        {pending ? (
          <PendingMark />
        ) : caption ? (
          <Text variant="caption" color={captionPositive ? 'success' : 'muted'} numberOfLines={1}>
            {caption}
          </Text>
        ) : null}
      </View>
      <View style={styles.chart}>
        <Sparkline values={values} tone="neutral" size="wide" />
      </View>
      <Text variant="button" style={styles.value}>
        {value}
      </Text>
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.md,
      paddingVertical: theme.spacing.md,
    },
    copy: {
      width: theme.sizes.measureLabel,
      flexShrink: 1,
      gap: theme.spacing.xxs / 2,
    },
    chart: {
      width: theme.sizes.measureSparklineWidth,
      height: theme.sizes.measureSparklineHeight,
    },
    value: {
      marginLeft: 'auto',
      flexShrink: 0,
      textAlign: 'right',
    },
  });
