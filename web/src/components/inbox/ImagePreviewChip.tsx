import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';

interface Props {
  previewUrl: string;
  onRemove: () => void;
}

/**
 * Thumbnail + remove control for a chat image staged in the composer, shown
 * above the input before send (#1096). `previewUrl` is a local object URL —
 * the caller owns creating/revoking it (see Composer.tsx).
 */
export default function ImagePreviewChip({ previewUrl, onRemove }: Props) {
  const { t } = useTranslation();

  return (
    <div className="relative inline-flex w-fit">
      <img
        src={previewUrl}
        alt={t('inbox.composer.imagePreviewAlt')}
        className="size-16 rounded-lg border border-border object-cover"
      />
      <Button
        type="button"
        variant="secondary"
        size="icon-xs"
        className="absolute -top-2 -right-2 rounded-full"
        onClick={onRemove}
        aria-label={t('inbox.composer.removeImageAriaLabel')}
      >
        <X className="size-3" aria-hidden="true" />
      </Button>
    </div>
  );
}
