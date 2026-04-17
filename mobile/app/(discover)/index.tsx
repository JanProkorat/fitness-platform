import { useState, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useTheme } from '@/hooks/useTheme';
import { href } from '@/lib/navigation';
import {
  searchProfessionals,
  type ProfessionalSummary,
  type SearchResponse,
} from '@/api/professionals';

const ROLE_LABELS: Record<string, string> = {
  Trainer: 'Trener',
  Nutritionist: 'Vyživovy poradce',
  PhysioTherapist: 'Fyzioterapeut',
};

export default function DiscoverScreen() {
  const colors = useTheme();
  const router = useRouter();
  const [searchText, setSearchText] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearchChange = useCallback((text: string) => {
    setSearchText(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(text.trim());
    }, 400);
  }, []);

  const { data, isLoading, isRefetching, refetch } = useQuery<SearchResponse>({
    queryKey: ['professionals', debouncedSearch],
    queryFn: () =>
      searchProfessionals({
        search: debouncedSearch || undefined,
        pageSize: 50,
      }),
  });

  const professionals = data?.items ?? [];

  const styles = useMemo(() => getStyles(colors), [colors]);

  const renderCard = useCallback(
    ({ item }: { item: ProfessionalSummary }) => (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.7}
        onPress={() => router.push(href(`/(discover)/${item.publicId}`))}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.cardName}>
            {item.firstName} {item.lastName}
          </Text>
          <View style={styles.roleBadge}>
            <Text style={styles.roleBadgeText}>
              {(item.roles ?? []).map(r => ROLE_LABELS[r] ?? r).join(' · ')}
            </Text>
          </View>
        </View>

        {(item.specializations ?? []).length > 0 && (
          <View style={styles.tagsRow}>
            {(item.specializations ?? []).map((spec) => (
              <View key={spec} style={styles.tag}>
                <Text style={styles.tagText}>{spec}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.cardMeta}>
          {item.city && <Text style={styles.metaText}>{item.city}</Text>}
          {item.city && item.estimatedPrice && (
            <Text style={styles.metaDot}> · </Text>
          )}
          {item.estimatedPrice && (
            <Text style={styles.metaText}>{item.estimatedPrice}</Text>
          )}
          {(item.city || item.estimatedPrice) && item.collaborationType && (
            <Text style={styles.metaDot}> · </Text>
          )}
          {item.collaborationType && (
            <Text style={styles.metaText}>{item.collaborationType}</Text>
          )}
        </View>
      </TouchableOpacity>
    ),
    [router],
  );

  const renderEmpty = () => {
    if (isLoading) return null;
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyIcon}>🔍</Text>
        <Text style={styles.emptyTitle}>Zadni vysledky</Text>
        <Text style={styles.emptyMessage}>
          Zkuste zmenit vyhledavaci dotaz nebo odebrat filtry.
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={styles.searchContainer}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Hledat trenera, nutricionistu..."
          placeholderTextColor={colors.label3}
          value={searchText}
          onChangeText={handleSearchChange}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
        />
        {searchText.length > 0 && (
          <TouchableOpacity
            onPress={() => {
              setSearchText('');
              setDebouncedSearch('');
            }}
            style={styles.clearBtn}
          >
            <Text style={styles.clearBtnText}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.gold} />
        </View>
      ) : (
        <FlatList
          data={professionals}
          keyExtractor={(item) => item.publicId ?? ''}
          renderItem={renderCard}
          ListEmptyComponent={renderEmpty}
          contentContainerStyle={styles.list}
          onRefresh={refetch}
          refreshing={isRefetching}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const getStyles = (colors: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    centered: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    searchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginHorizontal: 16,
      marginVertical: 12,
      backgroundColor: colors.bg2,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.sep,
      paddingHorizontal: 12,
      height: 44,
    },
    searchIcon: {
      fontSize: 16,
      marginRight: 8,
    },
    searchInput: {
      flex: 1,
      fontSize: 14,
      color: colors.label,
      paddingVertical: 0,
    },
    clearBtn: {
      marginLeft: 8,
      padding: 4,
    },
    clearBtnText: {
      fontSize: 14,
      color: colors.label3,
    },
    list: {
      paddingHorizontal: 16,
      paddingBottom: 20,
    },
    card: {
      backgroundColor: colors.bg2,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.sep,
      padding: 16,
      marginBottom: 12,
    },
    cardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    cardName: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.label,
      flex: 1,
    },
    roleBadge: {
      backgroundColor: 'rgba(200, 169, 78, 0.15)',
      paddingHorizontal: 10,
      paddingVertical: 3,
      borderRadius: 12,
      marginLeft: 8,
    },
    roleBadgeText: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.gold,
      textTransform: 'uppercase',
      letterSpacing: 0.3,
    },
    tagsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
      marginBottom: 10,
    },
    tag: {
      backgroundColor: colors.bg2,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.sep,
    },
    tagText: {
      fontSize: 12,
      fontWeight: '500',
      color: colors.label2,
    },
    cardMeta: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    metaText: {
      fontSize: 13,
      color: colors.label3,
    },
    metaDot: {
      fontSize: 13,
      color: colors.label3,
    },
    emptyContainer: {
      alignItems: 'center',
      paddingTop: 60,
      paddingHorizontal: 32,
    },
    emptyIcon: {
      fontSize: 40,
    },
    emptyTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.label2,
      marginTop: 12,
    },
    emptyMessage: {
      fontSize: 13,
      color: colors.label3,
      marginTop: 8,
      textAlign: 'center',
      lineHeight: 20,
    },
  });
