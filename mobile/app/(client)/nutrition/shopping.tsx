import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { createMMKV } from 'react-native-mmkv';
import { Colors } from '../../../constants/Colors';
import {
  getShoppingList,
  type ShoppingListItem,
} from '../../../src/api/nutrition';

const shoppingStorage = createMMKV({ id: 'shopping-checks' });

function getCheckedItems(): string[] {
  const raw = shoppingStorage.getString('checked');
  return raw ? JSON.parse(raw) : [];
}

function setCheckedItems(ids: string[]): void {
  shoppingStorage.set('checked', JSON.stringify(ids));
}

export default function ShoppingListScreen() {
  const router = useRouter();
  const [checkedIds, setCheckedIds] = useState<string[]>(getCheckedItems);

  const {
    data,
    isLoading,
    isError,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ['shopping-list'],
    queryFn: () => getShoppingList(),
  });

  const sortedItems = useMemo(() => {
    if (!data?.items) return [];
    const sorted = [...data.items].sort((a, b) =>
      a.foodName.localeCompare(b.foodName),
    );
    const checkedSet = new Set(checkedIds);
    const unchecked = sorted.filter((i) => !checkedSet.has(i.foodExternalId));
    const checked = sorted.filter((i) => checkedSet.has(i.foodExternalId));
    return [...unchecked, ...checked];
  }, [data?.items, checkedIds]);

  const checkedCount = useMemo(() => {
    if (!data?.items) return 0;
    const itemIds = new Set(data.items.map((i) => i.foodExternalId));
    return checkedIds.filter((id) => itemIds.has(id)).length;
  }, [data?.items, checkedIds]);

  const totalCount = data?.items.length ?? 0;

  const toggleItem = useCallback((foodExternalId: string) => {
    setCheckedIds((prev) => {
      const next = prev.includes(foodExternalId)
        ? prev.filter((id) => id !== foodExternalId)
        : [...prev, foodExternalId];
      setCheckedItems(next);
      return next;
    });
  }, []);

  const clearAll = useCallback(() => {
    setCheckedIds([]);
    setCheckedItems([]);
  }, []);

  const checkedSet = useMemo(() => new Set(checkedIds), [checkedIds]);

  const renderItem = useCallback(
    ({ item }: { item: ShoppingListItem }) => {
      const isChecked = checkedSet.has(item.foodExternalId);
      return (
        <TouchableOpacity
          style={styles.itemRow}
          onPress={() => toggleItem(item.foodExternalId)}
          activeOpacity={0.7}
        >
          <View
            style={[styles.checkbox, isChecked && styles.checkboxChecked]}
          >
            {isChecked && <Text style={styles.checkmark}>✓</Text>}
          </View>
          <View style={styles.itemInfo}>
            <Text
              style={[
                styles.itemName,
                isChecked && styles.itemNameChecked,
              ]}
            >
              {item.foodName}
            </Text>
            <Text
              style={[
                styles.itemAmount,
                isChecked && styles.itemAmountChecked,
              ]}
            >
              {formatAmount(item.totalAmountGrams)}
            </Text>
          </View>
        </TouchableOpacity>
      );
    },
    [checkedSet, toggleItem],
  );

  const keyExtractor = useCallback(
    (item: ShoppingListItem) => item.foodExternalId,
    [],
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Header onBack={() => router.back()} />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.dark.gold} />
        </View>
      </SafeAreaView>
    );
  }

  if (isError) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Header onBack={() => router.back()} />
        <View style={styles.centered}>
          <Text style={styles.emptyIcon}>🛒</Text>
          <Text style={styles.emptyTitle}>Failed to load shopping list</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => refetch()}>
            <Text style={styles.retryText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (!data?.items.length) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Header onBack={() => router.back()} />
        <View style={styles.centered}>
          <Text style={styles.emptyIcon}>🛒</Text>
          <Text style={styles.emptyTitle}>No items</Text>
          <Text style={styles.emptyHint}>
            Your plan may not have any foods yet
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Header onBack={() => router.back()} />

      <View style={styles.statusBar}>
        <Text style={styles.statusText}>
          {checkedCount} of {totalCount} items checked
        </Text>
        <View style={styles.statusActions}>
          <TouchableOpacity style={styles.shareButton} activeOpacity={0.7}>
            <Text style={styles.shareButtonText}>Share</Text>
          </TouchableOpacity>
          {checkedCount > 0 && (
            <TouchableOpacity
              style={styles.clearButton}
              onPress={clearAll}
              activeOpacity={0.7}
            >
              <Text style={styles.clearButtonText}>Clear all</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <FlatList
        data={sortedItems}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={Colors.dark.gold}
          />
        }
      />
    </SafeAreaView>
  );
}

function Header({ onBack }: { onBack: () => void }) {
  return (
    <View style={styles.header}>
      <TouchableOpacity onPress={onBack} style={styles.backButton}>
        <Text style={styles.backArrow}>‹</Text>
      </TouchableOpacity>
      <Text style={styles.title}>Shopping List</Text>
      <View style={styles.backButton} />
    </View>
  );
}

function formatAmount(grams: number): string {
  const rounded = Math.round(grams);
  if (rounded >= 1000) {
    return `${(rounded / 1000).toFixed(1)} kg`;
  }
  return `${rounded} g`;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backArrow: {
    fontSize: 32,
    color: Colors.dark.text,
    lineHeight: 36,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.dark.text,
  },
  statusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  statusText: {
    fontSize: 13,
    color: Colors.dark.text3,
    fontWeight: '600',
  },
  statusActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  shareButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  shareButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.dark.text3,
  },
  clearButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: Colors.dark.card,
  },
  clearButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.dark.gold,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.dark.border,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.dark.muted,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  checkboxChecked: {
    backgroundColor: Colors.dark.gold,
    borderColor: Colors.dark.gold,
  },
  checkmark: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.dark.background,
  },
  itemInfo: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemName: {
    fontSize: 15,
    fontWeight: '500',
    color: Colors.dark.text,
    flex: 1,
  },
  itemNameChecked: {
    opacity: 0.4,
    textDecorationLine: 'line-through',
  },
  itemAmount: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.dark.text2,
    marginLeft: 12,
  },
  itemAmountChecked: {
    opacity: 0.4,
    textDecorationLine: 'line-through',
  },
  emptyIcon: {
    fontSize: 48,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.dark.text3,
    marginTop: 16,
  },
  emptyHint: {
    fontSize: 13,
    color: Colors.dark.muted,
    marginTop: 4,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 20,
    backgroundColor: Colors.dark.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  retryText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.dark.gold,
  },
});
