import { useTranslation } from 'react-i18next';
import { PanelStatusHeader } from '@/components/inbox/panel/PanelPrimitives';

interface Props {
  name: string;
}

/** Shown when the other party is not (or no longer) a linked client: a declined, cancelled or expired proposal. */
export default function NotAClientPanel({ name }: Props) {
  const { t } = useTranslation();
  return (
    <div data-testid="not-a-client-panel" className="flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto px-4.5 py-5.5">
      <PanelStatusHeader name={name} description={t('inbox.panel.notAClient')} />
    </div>
  );
}
