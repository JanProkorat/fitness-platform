import { useTranslation } from 'react-i18next';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

export type ClientDetailTab = 'overview' | 'nutrition' | 'photos' | 'automations';

const TAB_KEYS = ['overview', 'nutrition', 'workouts', 'storage', 'payment', 'automations'] as const;
/** The `storage` label key now names the Photos tab; its route value is `photos`. */
const LIVE_TABS: readonly string[] = ['overview', 'nutrition', 'storage', 'automations'];

function tabValue(key: (typeof TAB_KEYS)[number]): string {
  return key === 'storage' ? 'photos' : key;
}

interface Props {
  /** The tab the current URL selects. */
  activeTab: ClientDetailTab;
  onTabChange: (tab: ClientDetailTab) => void;
  /** The coach's link grants the nutrition domain; false hides the Nutrition tab. */
  canViewNutritionPlans: boolean;
  /** The coach's link grants the training domain; false hides the Workouts tab. */
  canViewTrainingPlans: boolean;
}

/**
 * The tab row on the client-detail page — ClientsPage's underline Tabs
 * treatment, minus the row hairline (the header draws it). The active tab comes from the
 * URL (`/clients/:clientId`, `.../nutrition`, `.../photos` or `.../automations`); tabs that are
 * not built yet render disabled with the shell's coming-soon treatment.
 * Nutrition and Workouts show only for a link that grants the matching domain.
 */
export default function ClientDetailTabs({
  activeTab,
  onTabChange,
  canViewNutritionPlans,
  canViewTrainingPlans,
}: Props) {
  const { t } = useTranslation();
  const tabKeys = TAB_KEYS.filter((key) => {
    if (key === 'nutrition') {
      return canViewNutritionPlans;
    }
    if (key === 'workouts') {
      return canViewTrainingPlans;
    }
    return true;
  });

  return (
    <Tabs value={activeTab} onValueChange={(value) => {
        if (value === 'overview' || value === 'nutrition' || value === 'photos' || value === 'automations') {
          onTabChange(value);
        }
      }}>
      <div className="overflow-x-auto">
        {/* The hairline under the row belongs to the header, which shares it with the action buttons. */}
        <TabsList variant="underline" className="gap-6.5 border-b-0">
          {tabKeys.map((key) => {
            const isLive = LIVE_TABS.includes(key);
            return (
              <TabsTrigger
                key={key}
                value={tabValue(key)}
                variant="underline"
                className="text-body"
                disabled={!isLive}
                title={isLive ? undefined : t('shell.comingSoon')}
              >
                {t(`clientDetail.overview.tabs.${key}`)}
              </TabsTrigger>
            );
          })}
        </TabsList>
      </div>
    </Tabs>
  );
}
