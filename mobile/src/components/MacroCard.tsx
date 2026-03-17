import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../../constants/Colors';

interface MacroCardProps {
  label: string;
  current: number;
  target: number;
  color: string;
  unit?: string;
}

export function MacroCard({ label, current, target, color, unit = 'g' }: MacroCardProps) {
  const ratio = target > 0 ? current / target : 0;
  const capped = Math.min(ratio, 1);
  const isOver = ratio > 1;
  const barColor = isOver ? Colors.dark.red : color;

  return (
    <View style={styles.card}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.values}>
        <Text style={[styles.current, { color: barColor }]}>{Math.round(current)}</Text>
        {target > 0 ? (
          <Text style={styles.target}> / {Math.round(target)}{unit}</Text>
        ) : (
          <Text style={styles.target}> {unit}</Text>
        )}
      </Text>
      <View style={styles.barBg}>
        <View style={[styles.barFill, { width: `${capped * 100}%`, backgroundColor: barColor }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: Colors.dark.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    padding: 10,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.dark.text3,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  values: {
    marginTop: 4,
    fontSize: 14,
    fontWeight: '600',
  },
  current: {
    fontWeight: '800',
    fontSize: 16,
  },
  target: {
    color: Colors.dark.text3,
    fontSize: 12,
    fontWeight: '400',
  },
  barBg: {
    height: 4,
    backgroundColor: Colors.dark.border,
    borderRadius: 2,
    marginTop: 8,
    overflow: 'hidden',
  },
  barFill: {
    height: 4,
    borderRadius: 2,
  },
});
