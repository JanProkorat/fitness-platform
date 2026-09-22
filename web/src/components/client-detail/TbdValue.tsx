import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

interface Props {
  className?: string;
}

/**
 * The client-detail Overview tab's placeholder for a value the backend
 * cannot yet supply (#1094 — average rating, payments, estimated workout
 * minutes, the check-in trend). Renders in every locale, unstyled beyond a
 * muted colour, so it can drop into a stat card's value slot, a caption, or
 * a disabled header button without fighting the surrounding typography.
 */
export default function TbdValue({ className }: Props) {
  const { t } = useTranslation();
  return <span className={cn('text-muted-foreground', className)}>{t('clientDetail.overview.tbd')}</span>;
}
