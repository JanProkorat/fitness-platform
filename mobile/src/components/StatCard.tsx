import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/hooks/useTheme';

interface StatCardProps {
  label: string;
  value: string | number | null | undefined;
  unit?: string;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
}

export function StatCard({ label, value, unit, trend, trendValue }: StatCardProps) {
  const colors = useTheme();
  const trendColor =
    trend === 'down' ? colors.green : trend === 'up' ? colors.red : colors.label3;
  const trendIcon = trend === 'down' ? '\u25BC' : trend === 'up' ? '\u25B2' : '';
  const styles = useMemo(() => getStyles(colors), [colors]);

  return (
    <View style={styles.card}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.valueRow}>
        <Text style={styles.value}>
          {value != null ? value : '\u2014'}
        </Text>
        {unit && value != null && <Text style={styles.unit}>{unit}</Text>}
      </View>
      {trend && trendValue ? (
        <View style={styles.trendRow}>
          <Text style={[styles.trendIcon, { color: trendColor }]}>{trendIcon}</Text>
          <Text style={[styles.trendText, { color: trendColor }]}>{trendValue}</Text>
        </View>
      ) : (
        <View style={styles.trendRow}>
          <Text style={styles.trendText}> </Text>
        </View>
      )}
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
      padding: 12,
    },
    label: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.label3,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    valueRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      marginTop: 6,
    },
    value: {
      fontSize: 22,
      fontWeight: '800',
      color: colors.label,
    },
    unit: {
      fontSize: 13,
      fontWeight: '400',
      color: colors.label3,
      marginLeft: 4,
    },
    trendRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 4,
    },
    trendIcon: {
      fontSize: 10,
      marginRight: 3,
    },
    trendText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.label3,
    },
  });
}
