import Svg, { Polyline } from 'react-native-svg';

import { useTheme } from '@/theme';

/** Point list for a polyline in a width x height box; the highest value sits at the top. */
export function sparklinePoints(
  values: readonly number[],
  width: number,
  height: number,
  padding: number,
): string {
  const min = Math.min(...values);
  const range = Math.max(...values) - min;
  const innerHeight = height - padding * 2;
  const step = width / (values.length - 1);
  return values
    .map((value, index) => {
      const ratio = range === 0 ? 0.5 : (value - min) / range;
      return `${(index * step).toFixed(1)},${(padding + (1 - ratio) * innerHeight).toFixed(1)}`;
    })
    .join(' ');
}

export type SparklineTone = 'nutrition' | 'neutral';
export type SparklineSize = 'compact' | 'wide';

type SparklineProps = {
  values: readonly number[];
  /** Line colour; `nutrition` (green) is the default. */
  tone?: SparklineTone;
  /** `compact` fits a profile row, `wide` a measurements row. */
  size?: SparklineSize;
};

/** Small line chart of a series; renders nothing below two points. */
export function Sparkline({ values, tone = 'nutrition', size = 'compact' }: SparklineProps) {
  const theme = useTheme();
  const { sizes, colors } = theme;
  const width = size === 'wide' ? sizes.measureSparklineWidth : sizes.sparklineWidth;
  const height = size === 'wide' ? sizes.measureSparklineHeight : sizes.sparklineHeight;
  const stroke = tone === 'neutral' ? colors.ink2 : colors.nutrition;

  if (values.length < 2) return null;

  return (
    <Svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Polyline
        points={sparklinePoints(values, width, height, sizes.sparklinePadding)}
        fill="none"
        stroke={stroke}
        strokeWidth={sizes.sparklineStroke}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
