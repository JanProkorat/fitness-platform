import { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { isNetworkError } from '@/api/errors';
import { ROLE_NUTRITIONIST, ROLE_TRAINER } from '@/api/profile';
import type { CoachRole } from '@/api/professionals';
import { BackButton } from '@/components/BackButton';
import { Button } from '@/components/Button';
import { CoachRow } from '@/components/coach/CoachRow';
import { FilterChip } from '@/components/coach/FilterChip';
import { Input } from '@/components/Input';
import { Screen } from '@/components/Screen';
import { Segmented } from '@/components/onboarding/Segmented';
import type { SegmentOption } from '@/components/onboarding/Segmented';
import { Text } from '@/components/Text';
import { useCoachSearch } from '@/hooks/useCoachSearch';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

type Segment = 'All' | CoachRole;

const segmentFromParam = (role: string | undefined): Segment =>
  role === ROLE_TRAINER || role === ROLE_NUTRITIONIST ? role : 'All';

/** Coach search: role segments, filter chips, a name search and the paged results. */
export default function CoachSearchScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const theme = useTheme();
  const styles = makeStyles(theme);
  const insets = useSafeAreaInsets();
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

  const options: SegmentOption<Segment>[] = [
    { value: 'All', label: t('coachSearch.segments.All') },
    { value: ROLE_TRAINER, label: t('coachSearch.segments.Trainer') },
    { value: ROLE_NUTRITIONIST, label: t('coachSearch.segments.Nutritionist') },
  ];

  const toggleSearch = () => {
    if (searchOpen) {
      setDraft('');
      setSearch('');
    }
    setSearchOpen(!searchOpen);
  };

  const header = (
    <View style={styles.header}>
      <View style={styles.back}>
        <BackButton label={t('onboarding.back')} onPress={() => router.back()} />
      </View>
      <Text variant="title" accessibilityRole="header">
        {t('coachSearch.title')}
      </Text>
      <Segmented
        options={options}
        value={segment}
        onChange={(next) => {
          setSegment(next);
          setSpecialization(undefined);
        }}
        accessibilityLabel={t('coachSearch.segmentsLabel')}
      />
      {searchOpen ? (
        <Input
          label={t('coachSearch.searchLabel')}
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={() => setSearch(draft)}
          placeholder={t('coachSearch.searchPlaceholder')}
          autoFocus
          autoCorrect={false}
          returnKeyType="search"
          maxLength={100}
        />
      ) : null}
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
      {!result.isPending && !result.isError ? (
        <Text variant="bodySmall" color="muted">
          {t(`coachSearch.count.${segment}`, { count: result.totalCount })}
        </Text>
      ) : null}
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
      <FlatList
        data={result.isPending || result.isError ? [] : result.items}
        keyExtractor={(item) => item.publicId ?? ''}
        renderItem={({ item }) => (
          <CoachRow
            coach={item}
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
        contentContainerStyle={styles.list}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('coachSearch.searchButton')}
        onPress={toggleSearch}
        style={[styles.fab, { bottom: insets.bottom + theme.spacing.xl }]}
      >
        <SymbolView
          name={searchOpen ? 'xmark' : 'magnifyingglass'}
          tintColor={theme.colors.ink}
          size={theme.sizes.searchFabGlyph}
        />
      </Pressable>
    </Screen>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    header: {
      gap: theme.spacing.xl,
      paddingTop: theme.spacing.xxl,
      paddingBottom: theme.spacing.md,
    },
    back: {
      alignItems: 'flex-start',
    },
    chipScroll: {
      flexGrow: 0,
      marginHorizontal: -theme.spacing.xxl,
    },
    chips: {
      gap: theme.spacing.sm,
      paddingHorizontal: theme.spacing.xxl,
    },
    list: {
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
    fab: {
      position: 'absolute',
      right: theme.spacing.xxl,
      width: theme.sizes.searchFab,
      height: theme.sizes.searchFab,
      borderRadius: theme.radii.pill,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: theme.sizes.border,
      borderColor: theme.colors.line,
      backgroundColor: theme.colors.surface,
      boxShadow: theme.shadows.card,
    },
  });
