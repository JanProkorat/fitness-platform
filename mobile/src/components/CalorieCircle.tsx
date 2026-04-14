import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useTheme } from '@/hooks/useTheme';

interface CalorieCircleProps {
  consumed: number;
  target: number;
}

const SIZE = 140;
const STROKE_WIDTH = 10;
const RADIUS = (SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function CalorieCircle({ consumed, target }: CalorieCircleProps) {
  const colors = useTheme();
  const ratio = target > 0 ? consumed / target : 0;
  const capped = Math.min(ratio, 1);
  const isOver = ratio > 1;
  const offset = CIRCUMFERENCE * (1 - capped);
  const progressColor = isOver ? colors.red : colors.orange;

  const styles = useMemo(() => getStyles(colors), [colors]);

  return (
    <View style={styles.wrapper}>
      <Svg width={SIZE} height={SIZE}>
        {/* Background circle */}
        <Circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          stroke={colors.sep}
          strokeWidth={STROKE_WIDTH}
          fill="none"
        />
        {/* Progress arc */}
        <Circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          stroke={progressColor}
          strokeWidth={STROKE_WIDTH}
          fill="none"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
          strokeLinecap="round"
          rotation={-90}
          origin={`${SIZE / 2}, ${SIZE / 2}`}
        />
      </Svg>
      <View style={styles.center}>
        <Text style={[styles.consumed, isOver && styles.overColor]}>
          {Math.round(consumed)}
        </Text>
        {target > 0 ? (
          <Text style={styles.target}>/ {Math.round(target)} kcal</Text>
        ) : (
          <Text style={styles.target}>kcal</Text>
        )}
      </View>
    </View>
  );
}

function getStyles(colors: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    wrapper: {
      width: SIZE,
      height: SIZE,
      alignItems: 'center',
      justifyContent: 'center',
    },
    center: {
      position: 'absolute',
      alignItems: 'center',
    },
    consumed: {
      fontSize: 28,
      fontWeight: '800',
      color: colors.label,
    },
    overColor: {
      color: colors.red,
    },
    target: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.label3,
      marginTop: 2,
    },
  });
}
