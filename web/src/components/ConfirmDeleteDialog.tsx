import { useTranslation } from 'react-i18next';
import { Dialog } from '@/components/ui';
import { Button } from '@/components/ui';

interface ConfirmDeleteDialogProps {
  isOpen: boolean;
  name: string;
  isPending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  title?: string;
  message?: string;
}

export function ConfirmDeleteDialog({
  isOpen,
  name,
  isPending,
  onConfirm,
  onCancel,
  title,
  message,
}: ConfirmDeleteDialogProps) {
  const { t } = useTranslation();

  return (
    <Dialog
      open={isOpen}
      onClose={onCancel}
      title={title || t('common.deleteConfirmTitle')}
      footer={
        <>
          <Button onClick={onCancel} disabled={isPending}>
            {t('common.cancel')}
          </Button>
          <Button variant="danger" onClick={onConfirm} disabled={isPending}>
            {t('common.delete')}
          </Button>
        </>
      }
      maxWidth={400}
    >
      <p className="text-[13px] text-text2">
        {message || t('common.deleteConfirmMessage', { name })}
      </p>
    </Dialog>
  );
}
