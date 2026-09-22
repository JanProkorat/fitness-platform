import { useTranslation } from 'react-i18next';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

const DISABLED_TAB_KEYS = ['development', 'nutrition', 'workouts', 'storage', 'payment', 'automations'] as const;

/**
 * The seven-tab row on the client-detail page — reuses ClientsPage's
 * underline Tabs treatment verbatim (ClientsPage.tsx:196-230). Only
 * Overview is built (#1094); the other six render disabled with the
 * shell's coming-soon treatment and will be built in later epic sub-issues.
 * Uncontrolled (`defaultValue`) — there is nothing to switch to yet.
 */
export default function ClientDetailTabs() {
  const { t } = useTranslation();

  return (
    <Tabs defaultValue="overview">
      <div className="overflow-x-auto">
        <TabsList variant="underline">
          <TabsTrigger value="overview" variant="underline" className="text-body">
            {t('clientDetail.overview.tabs.overview')}
          </TabsTrigger>
          {DISABLED_TAB_KEYS.map((key) => (
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
