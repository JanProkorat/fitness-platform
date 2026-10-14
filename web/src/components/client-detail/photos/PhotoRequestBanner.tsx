import { useTranslation } from 'react-i18next';
import { Camera } from 'lucide-react';
import type { PhotoDiaryRequestSummary } from '@/api/diary-requests';
import { formatDayMonth } from '@/components/client-detail/photos/photoRequestModel';

interface Props {
  request: PhotoDiaryRequestSummary;
  name: string;
  /** True when no loaded photo was uploaded against this request yet. */
  waiting: boolean;
}

/** Notice above the gallery while a photo request is open. */
export default function PhotoRequestBanner({ request, name, waiting }: Props) {
  const { t, i18n } = useTranslation();

  return (
    <div
      role="status"
      className="flex items-center gap-3 rounded-xl bg-training-soft px-4 py-3 text-body text-training-ink"
    >
      <Camera className="size-4 shrink-0" aria-hidden="true" />
      <span>
        <b className="font-semibold">
          {t('clientDetail.photos.requestBanner.sent', { date: formatDayMonth(request.createdAt, i18n.language) })}
        </b>
        {waiting && ` · ${t('clientDetail.photos.requestBanner.waiting', { name })}`}
      </span>
    </div>
  );
}
