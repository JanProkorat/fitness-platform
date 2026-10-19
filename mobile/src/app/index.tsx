import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { SymbolView } from 'expo-symbols';
import type { SFSymbol } from 'expo-symbols';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { GlassTabBar } from '@/components/GlassTabBar';
import { Input } from '@/components/Input';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { useAuthStore } from '@/stores/auth';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

const TABS: { key: string; symbol: SFSymbol }[] = [
  { key: 'today', symbol: 'house' },
  { key: 'training', symbol: 'figure.strengthtraining.traditional' },
  { key: 'nutrition', symbol: 'leaf' },
  { key: 'messages', symbol: 'bubble.left' },
];

export default function Index() {
  const { t } = useTranslation();
  const theme = useTheme();
  const styles = makeStyles(theme);
  const [active, setActive] = useState('today');
  const [email, setEmail] = useState('');
  const barClearance = theme.sizes.tabBar + theme.sizes.tabBarBottom + theme.spacing.xxl;

  return (
    <View style={styles.root}>
      <Screen scroll bottomInset={barClearance} contentStyle={styles.content}>
        <Text variant="title">{t('showcase.title')}</Text>
        <Card style={styles.card}>
          <Text variant="subtitle">{t('showcase.card.title')}</Text>
          <Text variant="body" color="muted">
            {t('showcase.card.body')}
          </Text>
        </Card>
        <Input
          label={t('showcase.input.label')}
          placeholder={t('showcase.input.placeholder')}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <Input
          label={t('showcase.input.label')}
          placeholder={t('showcase.input.placeholder')}
          invalid
        />
        <Card style={styles.card}>
          <Text variant="body" color="muted">
            {t('showcase.scrollHint')}
          </Text>
        </Card>
        <Card style={styles.card}>
          <Text variant="body" color="muted">
            {t('showcase.scrollHint')}
          </Text>
        </Card>
        <Button
          label={t('showcase.signOut')}
          variant="destructive"
          onPress={() => void useAuthStore.getState().logout()}
        />
      </Screen>
      <GlassTabBar
        tabs={TABS.map(({ key, symbol }) => ({
          key,
          label: t(`showcase.tabs.${key}`),
          active: key === active,
          onPress: () => setActive(key),
          icon: (color: string) => (
            <SymbolView name={symbol} tintColor={color} size={theme.sizes.tabIcon} />
          ),
        }))}
      />
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: theme.colors.ground,
    },
    content: {
      gap: theme.spacing.xl,
    },
    card: {
      gap: theme.spacing.xs,
    },
  });
