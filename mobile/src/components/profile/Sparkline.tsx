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

/** Small line chart of a weight series; renders nothing below two points. */
export function Sparkline({ values }: { values: readonly number[] }) {
  const theme = useTheme();
  const { sparklineWidth: width, sparklineHeight: height } = theme.sizes;

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
        points={sparklinePoints(values, width, height, theme.sizes.sparklinePadding)}
        fill="none"
        stroke={theme.colors.nutrition}
        strokeWidth={theme.sizes.sparklineStroke}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
