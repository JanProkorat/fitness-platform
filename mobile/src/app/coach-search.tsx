import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { isNetworkError } from '@/api/errors';
import { ROLE_NUTRITIONIST, ROLE_TRAINER } from '@/api/profile';
import type { CoachRole } from '@/api/professionals';
import { Button } from '@/components/Button';
import { CoachCard } from '@/components/coach/CoachCard';
import { CoachSearchField } from '@/components/coach/CoachSearchField';
import { FilterChip } from '@/components/coach/FilterChip';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Segmented } from '@/components/onboarding/Segmented';
import type { SegmentOption } from '@/components/onboarding/Segmented';
import { Text } from '@/components/Text';
import { useCoachSearch } from '@/hooks/useCoachSearch';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

/** Pause after the last keystroke before the name search runs. */
const SEARCH_DEBOUNCE_MS = 350;

type Segment = 'All' | CoachRole;

const segmentFromParam = (role: string | undefined): Segment =>
  role === ROLE_TRAINER || role === ROLE_NUTRITIONIST ? role : 'All';

/** Coach search: role segments, filter chips, a name search field and the paged result cards. */
export default function CoachSearchScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const theme = useTheme();
  const styles = makeStyles(theme);
  const { role } = useLocalSearchParams<{ role?: string }>();

  const [segment, setSegment] = useState<Segment>(() => segmentFromParam(role));
  const [online, setOnline] = useState(false);
  const [specialization, setSpecialization] = useState<string | undefined>();
  const [searchOpen, setSearchOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [search, setSearch] = useState('');

  const result = useCoachSearch({
    role: segment === 'All' ? undefined : segment,
    search,
    specialization,
    online,
  });

  useEffect(() => {
    const handle = setTimeout(() => setSearch(draft.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [draft]);

  const options: SegmentOption<Segment>[] = [
    { value: 'All', label: t('coachSearch.segments.All') },
    { value: ROLE_TRAINER, label: t('coachSearch.segments.Trainer') },
    { value: ROLE_NUTRITIONIST, label: t('coachSearch.segments.Nutritionist') },
  ];

  const closeSearch = () => {
    setSearchOpen(false);
    setDraft('');
    setSearch('');
  };

  const topBar = (
    <View style={styles.topBar}>
      <ScreenHeader
        title={t(`coachSearch.title.${segment}`)}
        backLabel={t('onboarding.back')}
        onBack={() => router.back()}
      />
    </View>
  );

  const header = (
    <View style={styles.header}>
      <Segmented
        options={options}
        value={segment}
        onChange={(next) => {
          setSegment(next);
          setSpecialization(undefined);
        }}
        accessibilityLabel={t('coachSearch.segmentsLabel')}
      />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.chips}
        style={styles.chipScroll}
      >
        <FilterChip
          label={t('coachSearch.filters.online')}
          selected={online}
          onPress={() => setOnline(!online)}
        />
        {result.specialties.map((value) => (
          <FilterChip
            key={value}
            label={value}
            selected={specialization === value}
            onPress={() => setSpecialization(specialization === value ? undefined : value)}
          />
        ))}
      </ScrollView>
      {result.isPending || result.isError ? null : (
        <Text variant="caption" color="muted" style={styles.count}>
          {search
            ? t('coachSearch.countMatch', { count: result.totalCount, query: search })
            : t('coachSearch.count', { count: result.totalCount })}
        </Text>
      )}
    </View>
  );

  const body = (() => {
    if (result.isPending) {
      return (
        <View style={styles.state}>
          <ActivityIndicator color={theme.colors.accent} />
        </View>
      );
    }
    if (result.isError) {
      return (
        <View style={styles.state}>
          <Text variant="body" color="muted" style={styles.centered}>
            {isNetworkError(result.error) ? t('coachSearch.errors.network') : t('coachSearch.errors.generic')}
          </Text>
          <Button label={t('coachSearch.retry')} onPress={result.refetch} />
        </View>
      );
    }
    return null;
  })();

  return (
    <Screen>
      {topBar}
      <FlatList
        data={result.isPending || result.isError ? [] : result.items}
        keyExtractor={(item) => item.publicId ?? ''}
        renderItem={({ item }) => (
          <CoachCard
            coach={item}
            showRoles={segment === 'All'}
            onPress={() =>
              router.push({ pathname: '/coach/[publicId]', params: { publicId: item.publicId ?? '' } })
            }
          />
        )}
        ListHeaderComponent={header}
        ListEmptyComponent={
          body ?? (
            <View style={styles.state}>
              <Text variant="body" color="muted" style={styles.centered}>
                {t('coachSearch.empty')}
              </Text>
            </View>
          )
        }
        ListFooterComponent={
          result.isFetchingNextPage ? (
            <ActivityIndicator color={theme.colors.accent} style={styles.footer} />
          ) : null
        }
        onEndReached={() => {
          if (result.hasNextPage && !result.isFetchingNextPage) result.fetchNextPage();
        }}
        onEndReachedThreshold={0.4}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        style={styles.listScroll}
        contentContainerStyle={styles.list}
      />
      <CoachSearchField
        open={searchOpen}
        value={draft}
        onChangeText={setDraft}
        onOpen={() => setSearchOpen(true)}
        onClose={closeSearch}
      />
    </Screen>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    topBar: {
      paddingBottom: theme.spacing.lg,
    },
    header: {
      gap: theme.spacing.lg,
      paddingTop: theme.spacing.xs,
      paddingBottom: theme.spacing.xs,
    },
    count: {
      paddingHorizontal: theme.spacing.xxs,
    },
    chipScroll: {
      flexGrow: 0,
      marginHorizontal: -theme.spacing.xxl,
    },
    chips: {
      gap: theme.spacing.sm,
      paddingHorizontal: theme.spacing.xxl,
    },
    listScroll: {
      // Bleed into the screen gutter so the card shadow is not clipped at the list edge.
      marginHorizontal: -theme.spacing.xxl,
    },
    list: {
      gap: theme.spacing.sm,
      paddingHorizontal: theme.spacing.xxl,
      paddingBottom: theme.sizes.searchFab + theme.spacing.huge * 2,
    },
    state: {
      alignItems: 'stretch',
      gap: theme.spacing.xl,
      paddingVertical: theme.spacing.huge,
    },
    centered: {
      textAlign: 'center',
    },
    footer: {
      paddingVertical: theme.spacing.xl,
    },
  });
