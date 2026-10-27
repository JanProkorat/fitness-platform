import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { useTranslation } from 'react-i18next';

import { Text } from '@/components/Text';
import { monthTicks, valueAt, valueRange } from '@/components/journey/format';
import type { Domain, PlanBand, SeriesPoint } from '@/components/journey/format';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

/** Chart geometry in points; colours, spacing and type all come from the theme. */
const PLOT_HEIGHT = 132;
const MARKER_RADIUS = 5;
const LABEL_WIDTH = 44;
const MAX_MONTH_LABELS = 8;

type JourneyChartProps = {
  /** The measured values, oldest first; needs at least two points. */
  points: readonly SeriesPoint[];
  bands: readonly PlanBand[];
  /** Photo timestamps; each is marked on the line. */
  photoDates: readonly number[];
  domain: Domain;
};

/** Line chart of one measurement over the whole journey, with plan bands, photo markers and month labels. */
export function JourneyChart({ points, bands, photoDates, domain }: JourneyChartProps) {
  const { i18n } = useTranslation();
  const theme = useTheme();
  const styles = makeStyles(theme);
  const [width, setWidth] = useState(0);

  const onLayout = (event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width);

  const rows = (['training', 'nutrition'] as const).filter((kind) =>
    bands.some((band) => band.kind === kind),
  );
  const barHeight = theme.sizes.progressBar;
  const rowStep = barHeight + theme.spacing.xxs;
  const height = PLOT_HEIGHT + (rows.length > 0 ? theme.spacing.xs + rows.length * rowStep : 0);

  const left = MARKER_RADIUS;
  const right = Math.max(left, width - MARKER_RADIUS);
  const span = domain.end - domain.start;
  const x = (at: number) => left + ((at - domain.start) / span) * (right - left);

  const { min, max } = valueRange(points.map((point) => point.value));
  const y = (value: number) => MARKER_RADIUS + (1 - (value - min) / (max - min)) * (PLOT_HEIGHT - MARKER_RADIUS * 2);

  const line = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'}${x(point.at).toFixed(1)} ${y(point.value).toFixed(1)}`)
    .join(' ');

  const markers = photoDates.flatMap((at) => {
    const value = valueAt(points, at);
    return value === null || at < domain.start || at > domain.end ? [] : [{ at, value }];
  });

  const ticks = monthTicks(domain, i18n.language, MAX_MONTH_LABELS);
  const bandColor = (kind: PlanBand['kind']) =>
    kind === 'training' ? theme.colors.training : theme.colors.nutrition;

  return (
    <View onLayout={onLayout}>
      {width > 0 ? (
        <>
          <Svg
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            {bands.map((band, index) => (
              <Rect
                key={`band-${index}`}
                x={x(band.from)}
                y={0}
                width={Math.max(0, x(band.to) - x(band.from))}
                height={PLOT_HEIGHT}
                fill={bandColor(band.kind)}
                fillOpacity={theme.opacity.chartBand}
              />
            ))}
            <Path
              d={line}
              fill="none"
              stroke={theme.colors.ink}
              strokeWidth={theme.sizes.sparklineStroke}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {markers.map((marker, index) => (
              <Circle
                key={`photo-${index}`}
                cx={x(marker.at)}
                cy={y(marker.value)}
                r={MARKER_RADIUS}
                fill={theme.colors.surface}
                stroke={theme.colors.accent}
                strokeWidth={theme.sizes.sparklineStroke}
              />
            ))}
            {bands.map((band, index) => (
              <Rect
                key={`bar-${index}`}
                x={x(band.from)}
                y={PLOT_HEIGHT + theme.spacing.xs + rows.indexOf(band.kind) * rowStep}
                width={Math.max(0, x(band.to) - x(band.from))}
                height={barHeight}
                rx={barHeight / 2}
                fill={bandColor(band.kind)}
              />
            ))}
          </Svg>
          <View
            style={styles.axis}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            {ticks.map((tick) => (
              <Text
                key={tick.at}
                variant="label"
                color="muted"
                numberOfLines={1}
                style={[
                  styles.tick,
                  { left: Math.min(Math.max(x(tick.at) - LABEL_WIDTH / 2, 0), Math.max(0, width - LABEL_WIDTH)) },
                ]}
              >
                {tick.label}
              </Text>
            ))}
          </View>
        </>
      ) : null}
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    axis: {
      height: theme.typography.label.lineHeight,
      marginTop: theme.spacing.md,
    },
    tick: {
      position: 'absolute',
      width: LABEL_WIDTH,
      textAlign: 'center',
    },
  });
