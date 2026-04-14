import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/hooks/useTheme';

interface MacroCardProps {
  label: string;
  current: number;
  target: number;
  color: string;
  unit?: string;
}

export function MacroCard({ label, current, target, color, unit = 'g' }: MacroCardProps) {
  const colors = useTheme();
  const ratio = target > 0 ? current / target : 0;
  const capped = Math.min(ratio, 1);
  const isOver = ratio > 1;
  const barColor = isOver ? colors.red : color;
  const styles = useMemo(() => getStyles(colors), [colors]);

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

function getStyles(colors: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    card: {
      flex: 1,
      backgroundColor: colors.bg3,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.sep,
      padding: 10,
    },
    label: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.label3,
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
      color: colors.label3,
      fontSize: 12,
      fontWeight: '400',
    },
    barBg: {
      height: 4,
      backgroundColor: colors.sep,
      borderRadius: 2,
      marginTop: 8,
      overflow: 'hidden',
    },
    barFill: {
      height: 4,
      borderRadius: 2,
    },
  });
}
