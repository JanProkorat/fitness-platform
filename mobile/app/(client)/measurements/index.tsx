import React from 'react';
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
import { Colors } from '../../../constants/Colors';
import { getMeasurements, getMeasurementStats, type MeasurementDto } from '../../../src/api/measurements';
import { StatCard } from '../../../src/components/StatCard';
import { WeightChart } from '../../../src/components/WeightChart';

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

  const renderItem = ({ item }: { item: MeasurementDto }) => {
    const bodyParts: string[] = [];
    if (item.chestCm != null) bodyParts.push(`Chest ${item.chestCm}`);
    if (item.waistCm != null) bodyParts.push(`Waist ${item.waistCm}`);
    if (item.hipsCm != null) bodyParts.push(`Hips ${item.hipsCm}`);
    if (item.bicepsCm != null) bodyParts.push(`Biceps ${item.bicepsCm}`);
    if (item.thighsCm != null) bodyParts.push(`Thighs ${item.thighsCm}`);

    return (
      <View style={styles.measurementCard}>
        <Text style={styles.measurementDate}>{formatDate(item.measuredAt)}</Text>
        <View style={styles.measurementRow}>
          {item.weightKg != null && (
            <Text style={styles.weightValue}>{item.weightKg.toFixed(1)} kg</Text>
          )}
          {item.bodyFatPercentage != null && (
            <Text style={styles.bodyFat}>{item.bodyFatPercentage.toFixed(1)}% BF</Text>
          )}
        </View>
        {bodyParts.length > 0 && (
          <Text style={styles.bodyParts}>{bodyParts.join('  \u00B7  ')} cm</Text>
        )}
        {item.notes ? <Text style={styles.notes}>{item.notes}</Text> : null}
      </View>
    );
  };

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
        <Text style={styles.sectionTitle}>Weight Trend</Text>
        <View style={styles.chartCard}>
          <WeightChart data={chartData} />
        </View>
      </View>

      {/* History header */}
      <Text style={[styles.sectionTitle, styles.historyTitle]}>History</Text>
    </View>
  );

  const ListEmpty = () => {
    if (isLoading) {
      return (
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="large" color={Colors.dark.gold} />
        </View>
      );
    }
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No measurements yet.</Text>
        <Text style={styles.emptyHint}>Add your first measurement!</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Progress</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => router.push('/(client)/measurements/new')}
        >
          <Text style={styles.addButtonText}>ADD</Text>
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
            tintColor={Colors.dark.gold}
          />
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
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
    color: Colors.dark.text,
  },
  addButton: {
    backgroundColor: Colors.dark.gold,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addButtonText: {
    color: '#000',
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
    color: Colors.dark.text,
    marginBottom: 12,
  },
  chartCard: {
    backgroundColor: Colors.dark.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    padding: 8,
    overflow: 'hidden',
  },
  historyTitle: {
    marginTop: 4,
  },
  measurementCard: {
    backgroundColor: Colors.dark.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    padding: 14,
    marginBottom: 10,
  },
  measurementDate: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.dark.text3,
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
    color: Colors.dark.text,
  },
  bodyFat: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.dark.gold,
  },
  bodyParts: {
    fontSize: 12,
    color: Colors.dark.text2,
    marginTop: 6,
  },
  notes: {
    fontSize: 12,
    color: Colors.dark.text3,
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
    color: Colors.dark.text3,
  },
  emptyHint: {
    fontSize: 13,
    color: Colors.dark.muted,
    marginTop: 4,
  },
});
