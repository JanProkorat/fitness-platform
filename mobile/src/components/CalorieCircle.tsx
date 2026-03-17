import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Colors } from '../../constants/Colors';

interface CalorieCircleProps {
  consumed: number;
  target: number;
}

const SIZE = 140;
const STROKE_WIDTH = 10;
const RADIUS = (SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function CalorieCircle({ consumed, target }: CalorieCircleProps) {
  const ratio = target > 0 ? consumed / target : 0;
  const capped = Math.min(ratio, 1);
  const isOver = ratio > 1;
  const offset = CIRCUMFERENCE * (1 - capped);
  const progressColor = isOver ? Colors.dark.red : Colors.dark.kcal;

  return (
    <View style={styles.wrapper}>
      <Svg width={SIZE} height={SIZE}>
        {/* Background circle */}
        <Circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          stroke={Colors.dark.border}
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

const styles = StyleSheet.create({
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
    color: Colors.dark.text,
  },
  overColor: {
    color: Colors.dark.red,
  },
  target: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.dark.text3,
    marginTop: 2,
  },
});
