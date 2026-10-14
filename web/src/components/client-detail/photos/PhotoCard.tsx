import { useTranslation } from 'react-i18next';
import type { ClientPhotoResponse } from '@/api/generated';
import PhotoImage from '@/components/client-detail/photos/PhotoImage';
import PlanChip from '@/components/client-detail/photos/PlanChip';
import { formatCardDate, type PhotoPlanInfo } from '@/components/client-detail/photos/photosModel';

interface Props {
  photo: ClientPhotoResponse;
  plan: PhotoPlanInfo | undefined;
  locale: string;
  onOpen: () => void;
  onExpired: () => void;
}

/** One 3:4 photo tile with its date and plan chip; opens the viewer. */
export default function PhotoCard({ photo, plan, locale, onOpen, onExpired }: Props) {
  const { t } = useTranslation();
  const date = formatCardDate(photo.takenAt, locale);

  return (
    <li data-testid="client-photo" className="flex min-w-0 flex-col gap-2">
      <button
        type="button"
        onClick={onOpen}
        aria-label={t('clientDetail.photos.openPhoto', { date })}
        className="block aspect-[3/4] w-full overflow-hidden rounded-2xl bg-muted outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <PhotoImage
          key={photo.id}
          src={photo.displayUrl}
          alt={t('clientDetail.photos.photoAlt', { date })}
          onExpired={onExpired}
          className="size-full"
        />
      </button>
      <span className="text-body font-semibold text-ink">{date}</span>
      {plan && (
        <div className="flex">
          <PlanChip plan={plan} />
        </div>
      )}
    </li>
  );
}
