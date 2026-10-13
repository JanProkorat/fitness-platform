import { useTranslation } from 'react-i18next';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

export type ClientDetailTab = 'overview' | 'nutrition';

const TAB_KEYS = ['overview', 'development', 'nutrition', 'workouts', 'storage', 'payment', 'automations'] as const;
const LIVE_TABS: readonly string[] = ['overview', 'nutrition'];

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
 * The tab row on the client-detail page — reuses ClientsPage's underline Tabs
 * treatment verbatim (ClientsPage.tsx:196-230). The active tab comes from the
 * URL (`/clients/:clientId` or `/clients/:clientId/nutrition`); tabs that are
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
        if (value === 'overview' || value === 'nutrition') {
          onTabChange(value);
        }
      }}>
      <div className="overflow-x-auto">
        <TabsList variant="underline">
          {tabKeys.map((key) => {
            const isLive = LIVE_TABS.includes(key);
            return (
              <TabsTrigger
                key={key}
                value={key}
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
