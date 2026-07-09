/**
 * DiaryRequestStatusChip — inline pill showing the lifecycle status of a
 * photo diary request.
 *
 * For InProgress, it shows "Day N of M" computed from acceptedAt, using the
 * same local-calendar-day logic as DiaryRequestCard's day grouping (#644) —
 * previously this chip used a 24h rolling window from `acceptedAt`, which
 * disagreed with the card's calendar-day buckets for photos taken near
 * local midnight.
 * For Dismissed, a separate DismissReason display is handled by the caller.
 *
 * Status-chip colours resolve through CSS custom properties defined in
 * index.css (--status-*) so they respect the dark-mode theme.
 */

import { useTranslation } from 'react-i18next';
import { PhotoDiaryStatus } from '@/api/generated';
import type { PhotoDiaryRequestSummary } from '@/api/diary-requests';
import { computeCalendarDayNumber } from './diaryDayNumber';

interface Props {
  request: PhotoDiaryRequestSummary;
}

export function DiaryRequestStatusChip({ request }: Props) {
  const { t } = useTranslation();
  const { status, acceptedAt, durationDays = 7 } = request;

  let label: string;
  let style: React.CSSProperties;

  switch (status) {
    case PhotoDiaryStatus.Pending:
      label = t('diary.viewer.statusPending');
      style = {
        color: 'var(--status-pending-text)',
        background: 'var(--status-pending-bg)',
        border: '1px solid var(--status-pending-br)',
      };
      break;

    case PhotoDiaryStatus.Accepted:
      label = t('diary.viewer.statusAccepted');
      style = {
        color: 'var(--status-accepted-text)',
        background: 'var(--status-accepted-bg)',
        border: '1px solid var(--status-accepted-br)',
      };
      break;

    case PhotoDiaryStatus.InProgress: {
      const day = acceptedAt
        ? computeCalendarDayNumber(new Date().toISOString(), acceptedAt, durationDays)
        : 1;
      label = t('diary.viewer.statusInProgress', { day, total: durationDays });
      style = {
        color: 'var(--status-inprogress-text)',
        background: 'var(--status-inprogress-bg)',
        border: '1px solid var(--status-inprogress-br)',
      };
      break;
    }

    case PhotoDiaryStatus.Completed:
      label = t('diary.viewer.statusCompleted');
      style = {
        color: 'var(--status-completed-text)',
        background: 'var(--status-completed-bg)',
        border: '1px solid var(--status-completed-br)',
      };
      break;

    case PhotoDiaryStatus.Dismissed:
      label = t('diary.viewer.statusDismissed');
      style = {
        color: 'var(--status-dismissed-text)',
        background: 'var(--status-dismissed-bg)',
        border: '1px solid var(--status-dismissed-br)',
      };
      break;

    default:
      label = status ?? '—';
      style = {
        color: 'var(--text3)',
        background: 'var(--bg2)',
        border: '1px solid var(--border)',
      };
  }

  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap"
      style={style}
    >
      {label}
    </span>
  );
}
