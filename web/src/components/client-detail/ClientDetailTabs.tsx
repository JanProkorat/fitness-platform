import { useTranslation } from 'react-i18next';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

const DISABLED_TAB_KEYS = ['development', 'nutrition', 'workouts', 'storage', 'payment', 'automations'] as const;

interface Props {
  /** The coach's link grants the nutrition domain; false hides the Nutrition tab. */
  canViewNutritionPlans: boolean;
  /** The coach's link grants the training domain; false hides the Workouts tab. */
  canViewTrainingPlans: boolean;
}

/**
 * The tab row on the client-detail page — reuses ClientsPage's underline Tabs
 * treatment verbatim (ClientsPage.tsx:196-230). Only Overview is built
 * (#1094); the rest render disabled with the shell's coming-soon treatment
 * and will be built in later epic sub-issues. Nutrition and Workouts show
 * only for a link that grants the matching domain. Uncontrolled
 * (`defaultValue`) — there is nothing to switch to yet.
 */
export default function ClientDetailTabs({ canViewNutritionPlans, canViewTrainingPlans }: Props) {
  const { t } = useTranslation();
  const tabKeys = DISABLED_TAB_KEYS.filter((key) => {
    if (key === 'nutrition') {
      return canViewNutritionPlans;
    }
    if (key === 'workouts') {
      return canViewTrainingPlans;
    }
    return true;
  });

  return (
    <Tabs defaultValue="overview">
      <div className="overflow-x-auto">
        <TabsList variant="underline">
          <TabsTrigger value="overview" variant="underline" className="text-body">
            {t('clientDetail.overview.tabs.overview')}
          </TabsTrigger>
          {tabKeys.map((key) => (
            <TabsTrigger
              key={key}
              value={key}
              variant="underline"
              className="text-body"
              disabled
              title={t('shell.comingSoon')}
            >
              {t(`clientDetail.overview.tabs.${key}`)}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
    </Tabs>
  );
}
