import React, { useMemo } from 'react';
import { View, Text, StyleSheet, LayoutChangeEvent } from 'react-native';
import Svg, { Line, Circle, Polyline, Text as SvgText, G } from 'react-native-svg';
import { useTheme } from '@/hooks/useTheme';

interface WeightChartProps {
  data: { date: string; weight: number }[];
}

const CHART_HEIGHT = 200;
const PADDING_LEFT = 48;
const PADDING_RIGHT = 16;
const PADDING_TOP = 16;
const PADDING_BOTTOM = 32;

function formatDateLabel(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()}.${d.getMonth() + 1}.`;
}

export function WeightLineChart({ data }: WeightChartProps) {
  const colors = useTheme();
  const [containerWidth, setContainerWidth] = React.useState(0);

  const onLayout = (e: LayoutChangeEvent) => {
    setContainerWidth(e.nativeEvent.layout.width);
  };

  const styles = useMemo(() => getStyles(colors), [colors]);

  if (data.length < 2) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>Not enough data for chart</Text>
      </View>
    );
  }

  if (containerWidth === 0) {
    return <View style={styles.container} onLayout={onLayout} />;
  }

  const weights = data.map((d) => d.weight);
  const minW = Math.min(...weights);
  const maxW = Math.max(...weights);
  const range = maxW - minW || 1;
  const padded = range * 0.15;
  const yMin = minW - padded;
  const yMax = maxW + padded;
  const yRange = yMax - yMin;

  const plotW = containerWidth - PADDING_LEFT - PADDING_RIGHT;
  const plotH = CHART_HEIGHT - PADDING_TOP - PADDING_BOTTOM;

  const toX = (i: number) => PADDING_LEFT + (i / (data.length - 1)) * plotW;
  const toY = (w: number) => PADDING_TOP + plotH - ((w - yMin) / yRange) * plotH;

  const points = data.map((d, i) => `${toX(i)},${toY(d.weight)}`).join(' ');

  // Y-axis labels: min, mid, max
  const yLabels = [yMin, yMin + yRange / 2, yMax].map((v) => ({
    value: v.toFixed(1),
    y: toY(v),
  }));

  // X-axis labels: first, middle, last
  const xIndices = [0, Math.floor(data.length / 2), data.length - 1];
  // Deduplicate if data.length <= 2
  const uniqueXIndices = [...new Set(xIndices)];

  // Horizontal grid lines
  const gridYs = yLabels.map((l) => l.y);

  return (
    <View style={styles.container} onLayout={onLayout}>
      <Svg width={containerWidth} height={CHART_HEIGHT}>
        {/* Grid lines */}
        {gridYs.map((gy, i) => (
          <Line
            key={`grid-${i}`}
            x1={PADDING_LEFT}
            y1={gy}
            x2={containerWidth - PADDING_RIGHT}
            y2={gy}
            stroke={colors.sep}
            strokeWidth={1}
          />
        ))}

        {/* Y-axis labels */}
        {yLabels.map((l, i) => (
          <SvgText
            key={`y-${i}`}
            x={PADDING_LEFT - 8}
            y={l.y + 4}
            fill={colors.label3}
            fontSize={11}
            textAnchor="end"
          >
            {l.value}
          </SvgText>
        ))}

        {/* X-axis labels */}
        {uniqueXIndices.map((idx) => (
          <SvgText
            key={`x-${idx}`}
            x={toX(idx)}
            y={CHART_HEIGHT - 6}
            fill={colors.label3}
            fontSize={11}
            textAnchor="middle"
          >
            {formatDateLabel(data[idx].date)}
          </SvgText>
        ))}

        {/* Line */}
        <Polyline
          points={points}
          fill="none"
          stroke={colors.gold}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Dots */}
        <G>
          {data.map((d, i) => (
            <Circle
              key={`dot-${i}`}
              cx={toX(i)}
              cy={toY(d.weight)}
              r={3.5}
              fill={colors.gold}
            />
          ))}
        </G>
      </Svg>
    </View>
  );
}

function getStyles(colors: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    container: {
      width: '100%',
      height: CHART_HEIGHT,
    },
    empty: {
      height: CHART_HEIGHT,
      justifyContent: 'center',
      alignItems: 'center',
    },
    emptyText: {
      fontSize: 14,
      color: colors.label3,
    },
  });
}
