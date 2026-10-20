import { useTranslation } from 'react-i18next';
import { PanelFactsCard, type PanelFact } from '@/components/inbox/panel/PanelPrimitives';
import { inviteExpiresAt } from '@/lib/cooperationCards';

interface Props {
  email?: string;
  sentAt?: string;
}

/** The invite's email, sent date and expiry (sent + the invite validity window). */
export default function InviteSummaryCard({ email, sentAt }: Props) {
  const { t, i18n } = useTranslation();
  const formatDay = (date: Date) => date.toLocaleDateString(i18n.language, { day: 'numeric', month: 'short' });
  const facts: PanelFact[] = [];

  if (email) {
    facts.push({ label: t('inbox.panel.invite.email'), value: email });
  }
  if (sentAt) {
    facts.push({ label: t('inbox.panel.invite.sent'), value: formatDay(new Date(sentAt)) });
    facts.push({ label: t('inbox.panel.invite.expires'), value: formatDay(inviteExpiresAt(sentAt)) });
  }

  return <PanelFactsCard testId="invite-summary-card" title={t('inbox.panel.invite.title')} facts={facts} />;
}
