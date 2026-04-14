import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useTheme } from '@/hooks/useTheme';
import { getMeasurements, getMeasurementStats, type MeasurementDto } from '@/api/measurements';
import { StatCard } from '@/components/StatCard';
import { WeightLineChart } from '@/components/WeightLineChart';

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatNumber(v: number | null | undefined, decimals = 1): string | null {
  if (v == null) return null;
  return v.toFixed(decimals);
}

export default function MeasurementsScreen() {
  const router = useRouter();
  const colors = useTheme();

  const measurementsQuery = useQuery({
    queryKey: ['measurements'],
    queryFn: () => getMeasurements({ pageSize: 50 }),
  });

  const statsQuery = useQuery({
    queryKey: ['measurement-stats'],
    queryFn: getMeasurementStats,
  });

  const isLoading = measurementsQuery.isLoading || statsQuery.isLoading;
  const isRefreshing = measurementsQuery.isRefetching || statsQuery.isRefetching;

  const onRefresh = () => {
    measurementsQuery.refetch();
    statsQuery.refetch();
  };

  const stats = statsQuery.data;
  const items = measurementsQuery.data?.items ?? [];

  // Prepare chart data: sorted chronologically, only items with weight
  const chartData = items
    .filter((m): m is MeasurementDto & { weightKg: number } => m.weightKg != null)
    .map((m) => ({ date: m.measuredAt, weight: m.weightKg }))
    .reverse(); // API returns newest first, chart needs oldest first

  const weightTrend: 'up' | 'down' | 'neutral' | undefined =
    stats?.weightChange30Days != null
      ? stats.weightChange30Days > 0
        ? 'up'
        : stats.weightChange30Days < 0
          ? 'down'
          : 'neutral'
      : undefined;

  const weightTrendValue =
    stats?.weightChange30Days != null
      ? `${stats.weightChange30Days > 0 ? '+' : ''}${stats.weightChange30Days.toFixed(1)} kg / 30d`
      : undefined;

  const renderItem = useCallback(({ item }: { item: MeasurementDto }) => {
    const bodyParts: string[] = [];
    if (item.chestCm != null) bodyParts.push(`Chest ${item.chestCm}`);
    if (item.waistCm != null) bodyParts.push(`Waist ${item.waistCm}`);
    if (item.hipsCm != null) bodyParts.push(`Hips ${item.hipsCm}`);
    if (item.bicepsCm != null) bodyParts.push(`Biceps ${item.bicepsCm}`);
    if (item.thighsCm != null) bodyParts.push(`Thighs ${item.thighsCm}`);

    return (
      <View style={[styles.measurementCard, { backgroundColor: colors.bg2, borderColor: colors.sep }]}>
        <Text style={[styles.measurementDate, { color: colors.label3 }]}>{formatDate(item.measuredAt)}</Text>
        <View style={styles.measurementRow}>
          {item.weightKg != null && (
            <Text style={[styles.weightValue, { color: colors.label }]}>{item.weightKg.toFixed(1)} kg</Text>
          )}
          {item.bodyFatPercentage != null && (
            <Text style={[styles.bodyFat, { color: colors.gold }]}>{item.bodyFatPercentage.toFixed(1)}% BF</Text>
          )}
        </View>
        {bodyParts.length > 0 && (
          <Text style={[styles.bodyParts, { color: colors.label2 }]}>{bodyParts.join('  \u00B7  ')} cm</Text>
        )}
        {item.notes ? <Text style={[styles.notes, { color: colors.label3 }]}>{item.notes}</Text> : null}
      </View>
    );
  }, [colors]);

  const ListHeader = () => (
    <View>
      {/* Stats grid */}
      {stats && (
        <View style={styles.statsSection}>
          <View style={styles.statsRow}>
            <StatCard
              label="Latest"
              value={formatNumber(stats.latestWeight)}
              unit="kg"
              trend={weightTrend}
              trendValue={weightTrendValue}
            />
            <View style={styles.statGap} />
            <StatCard
              label="Average"
              value={formatNumber(stats.avgWeight)}
              unit="kg"
            />
          </View>
          <View style={styles.statsRow}>
            <StatCard
              label="Min"
              value={formatNumber(stats.minWeight)}
              unit="kg"
            />
            <View style={styles.statGap} />
            <StatCard
              label="Measurements"
              value={stats.totalCount}
            />
          </View>
        </View>
      )}

      {/* Chart */}
      <View style={styles.chartSection}>
        <Text style={[styles.sectionTitle, { color: colors.label }]}>Weight Trend</Text>
        <View style={[styles.chartCard, { backgroundColor: colors.bg2, borderColor: colors.sep }]}>
          <WeightLineChart data={chartData} />
        </View>
      </View>

      {/* History header */}
      <Text style={[styles.sectionTitle, styles.historyTitle, { color: colors.label }]}>History</Text>
    </View>
  );

  const ListEmpty = () => {
    if (isLoading) {
      return (
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="large" color={colors.gold} />
        </View>
      );
    }
    return (
      <View style={styles.emptyContainer}>
        <Text style={[styles.emptyText, { color: colors.label3 }]}>No measurements yet.</Text>
        <Text style={[styles.emptyHint, { color: colors.label3 }]}>Add your first measurement!</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top']}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.label }]}>Progress</Text>
        <TouchableOpacity
          style={[styles.addButton, { backgroundColor: colors.gold }]}
          onPress={() => router.push('/(client)/measurements/new')}
        >
          <Text style={[styles.addButtonText, { color: colors.label }]}>ADD</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => item.measurementId}
        renderItem={renderItem}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={ListEmpty}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor={colors.gold}
          />
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
  },
  addButton: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addButtonText: {
    fontWeight: '800',
    fontSize: 13,
    letterSpacing: 0.5,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  statsSection: {
    gap: 10,
    marginBottom: 20,
  },
  statsRow: {
    flexDirection: 'row',
  },
  statGap: {
    width: 10,
  },
  chartSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  chartCard: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 8,
    overflow: 'hidden',
  },
  historyTitle: {
    marginTop: 4,
  },
  measurementCard: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
  },
  measurementDate: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  measurementRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 12,
  },
  weightValue: {
    fontSize: 20,
    fontWeight: '800',
  },
  bodyFat: {
    fontSize: 14,
    fontWeight: '600',
  },
  bodyParts: {
    fontSize: 12,
    marginTop: 6,
  },
  notes: {
    fontSize: 12,
    marginTop: 6,
    fontStyle: 'italic',
  },
  emptyContainer: {
    paddingTop: 60,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
  },
  emptyHint: {
    fontSize: 13,
    marginTop: 4,
  },
});
