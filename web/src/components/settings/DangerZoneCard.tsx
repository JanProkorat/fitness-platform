import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMutation } from '@tanstack/react-query';
import { Power, Trash2 } from 'lucide-react';
import { deleteMyAccount } from '@/api/profile';
import { getApiErrorMessage } from '@/lib/api-errors';
import { useAuthStore } from '@/stores/auth';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import SettingsCard from '@/components/settings/SettingsCard';

export default function DangerZoneCard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const deleteMutation = useMutation({
    mutationFn: deleteMyAccount,
    onSuccess: () => {
      useAuthStore.getState().logout();
      navigate('/', { replace: true });
    },
    onError: (error) => setErrorMessage(getApiErrorMessage(error, 'settings.danger.deleteError')),
  });

  const close = (open: boolean) => {
    if (deleteMutation.isPending) return;
    setConfirmOpen(open);
    if (!open) setErrorMessage(null);
  };

  return (
    <SettingsCard title={t('settings.danger.title')} description={t('settings.danger.description')} danger>
      <div className="flex items-center gap-4">
        <div className="flex min-w-0 flex-col gap-0.75">
          <h3 className="text-copy font-semibold text-ink">{t('settings.danger.disableTitle')}</h3>
          <p className="text-body leading-snug text-muted-foreground">{t('settings.danger.disableBody')}</p>
        </div>
        <Button
          type="button"
          variant="outline"
          disabled
          title={t('shell.comingSoon')}
          className="ml-auto h-9 shrink-0 gap-1.75 rounded-field border-error/30 px-3.5 font-semibold text-error"
        >
          <Power className="size-3.75" aria-hidden="true" />
          {t('settings.danger.disable')}
        </Button>
      </div>
      <div className="flex items-center gap-4 border-t border-border pt-4.5">
        <div className="flex min-w-0 flex-col gap-0.75">
          <h3 className="text-copy font-semibold text-ink">{t('settings.danger.deleteTitle')}</h3>
          <p className="text-body leading-snug text-muted-foreground">{t('settings.danger.deleteBody')}</p>
        </div>
        <Button
          type="button"
          onClick={() => setConfirmOpen(true)}
          className="ml-auto h-9 shrink-0 gap-1.75 rounded-field bg-error px-3.5 font-semibold text-primary-foreground hover:bg-error/90"
        >
          <Trash2 className="size-3.75" aria-hidden="true" />
          {t('settings.danger.delete')}
        </Button>
      </div>

      <Dialog open={confirmOpen} onOpenChange={close}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>{t('settings.danger.confirmTitle')}</DialogTitle>
            <DialogDescription>{t('settings.danger.confirmBody')}</DialogDescription>
          </DialogHeader>
          {errorMessage && (
            <p role="alert" className="text-body text-error">
              {errorMessage}
            </p>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="lg"
              disabled={deleteMutation.isPending}
              onClick={() => close(false)}
            >
              {t('common.cancel')}
            </Button>
            <Button
              type="button"
              size="lg"
              disabled={deleteMutation.isPending}
              onClick={() => {
                setErrorMessage(null);
                deleteMutation.mutate();
              }}
              className="bg-error text-primary-foreground hover:bg-error/90"
            >
              {t('settings.danger.confirmAction')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SettingsCard>
  );
}
