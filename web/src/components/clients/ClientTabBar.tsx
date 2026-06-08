import { useTranslation } from 'react-i18next';

export type ClientTabId =
  | 'prehled'
  | 'mereni'
  | 'fotky'
  | 'aktivita'
  | 'plany'
  | 'checkiny'
  | 'dotazniky'
  | 'poznamky';

interface ClientTabBarProps {
  activeTab: ClientTabId;
  onTabChange: (tab: ClientTabId) => void;
}

interface TabDef {
  id: ClientTabId;
  labelKey: string;
}

const TABS: TabDef[] = [
  { id: 'prehled',    labelKey: 'clientDetail.tabs.prehled' },
  { id: 'mereni',     labelKey: 'clientDetail.tabs.mereni' },
  { id: 'fotky',      labelKey: 'clientDetail.tabs.fotky' },
  { id: 'aktivita',   labelKey: 'clientDetail.tabs.aktivita' },
  { id: 'plany',      labelKey: 'clientDetail.tabs.plany' },
  { id: 'checkiny',   labelKey: 'clientDetail.tabs.checkiny' },
  { id: 'dotazniky',  labelKey: 'clientDetail.tabs.dotazniky' },
  { id: 'poznamky',   labelKey: 'clientDetail.tabs.poznamky' },
];

export function ClientTabBar({ activeTab, onTabChange }: ClientTabBarProps) {
  const { t } = useTranslation();

  return (
    <div
      className="flex items-center gap-1 px-20 py-2 border-b border-border"
      role="tablist"
      aria-label={t('clientDetail.tabBarLabel')}
    >
      {TABS.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-controls={`cl-pane-${tab.id}`}
            id={`cl-tab-${tab.id}`}
            onClick={() => onTabChange(tab.id)}
            className={
              isActive
                ? 'inline-flex items-center px-3 py-1 rounded-full text-[13px] font-medium cursor-pointer bg-accent text-white border-none'
                : 'inline-flex items-center px-3 py-1 rounded-full text-[13px] font-medium cursor-pointer bg-transparent text-text2 border-none hover:text-text transition-colors'
            }
          >
            {t(tab.labelKey)}
          </button>
        );
      })}
    </div>
  );
}
