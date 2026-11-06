import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { getMySubscription, subscriptionKeys } from '@/api/subscription';
import type { GetMySubscriptionResponse, SubscriptionFeaturesDto } from '@/api/generated';
import { useAuthStore } from '@/stores/auth';

const COACH_ROLES = new Set(['trainer', 'nutritionist']);

export type SubscriptionFeature = keyof SubscriptionFeaturesDto;

/** Plan name in the given UI language, falling back to English, Czech, then the plan code. */
export function planNameFor(subscription: GetMySubscriptionResponse | undefined, language: string): string {
  if (!subscription) return '';
  const lang = language.slice(0, 2).toLowerCase();
  const byLang = lang === 'cs' ? subscription.nameCs : lang === 'de' ? subscription.nameDe : subscription.nameEn;
  return byLang || subscription.nameEn || subscription.nameCs || subscription.nameDe || subscription.planCode || '';
}

/**
 * The signed-in coach's subscription, one shared query. Disabled for anyone without a
 * Trainer/Nutritionist role (the endpoint would answer 403), so no request and no error UI there.
 */
export function useSubscription() {
  const { i18n } = useTranslation();
  const isCoach = useAuthStore((s) => s.user?.roles.some((role) => COACH_ROLES.has(role.toLowerCase())) ?? false);
  const query = useQuery({
    queryKey: subscriptionKeys.mine,
    queryFn: getMySubscription,
    enabled: isCoach,
  });
  const data = query.data;

  return {
    query,
    isCoach,
    data,
    planName: planNameFor(data, i18n.language),
    features: data?.features,
    /** True unless the loaded plan says no: unknown or failed lookups never lock the UI. */
    isEntitled: (feature: SubscriptionFeature) => data?.features?.[feature] !== false,
    /** Null means unlimited. */
    clientLimit: data?.clientLimit ?? null,
    activeClientCount: data?.activeClientCount ?? 0,
  };
}

/** Refetches the subscription after something that changes client count or plan. */
export function useInvalidateSubscription() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: subscriptionKeys.mine });
}
