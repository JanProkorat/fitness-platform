import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, CirclePlay, CreditCard, Info, Lock, Power } from 'lucide-react';
import { disableCoachAccount, formatLongDate, getMyCoachRoles, isInFuture, rolesKeys } from '@/api/roles';
import { profileKeys } from '@/api/profile';
import { getApiErrorMessage, getErrorCode, showSuccess } from '@/lib/api-errors';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface Props {
  open: boolean;
  onClose: () => void;
}

function Row({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-tile bg-sunken text-ink-2">{icon}</span>
      <div className="flex flex-col gap-0.5">
        <span className="text-copy font-semibold text-ink">{title}</span>
        <span className="text-body leading-snug text-muted-foreground">{children}</span>
      </div>
    </li>
  );
}

/** Confirm dialog for disabling the coach account; shared by the Danger zone and the only-role Remove button. */
export default function DisableAccountDialog({ open, onClose }: Props) {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const rolesQuery = useQuery({ queryKey: rolesKeys.mine, queryFn: getMyCoachRoles, enabled: open });
  const roleNames = (rolesQuery.data?.roles ?? [])
    .map((summary) => t(`roles.${summary.role.toLowerCase()}`, { defaultValue: summary.role }))
    .join(', ');
  const activeUntil = rolesQuery.data?.activeUntilIfDisabled ?? null;
  // At or before now there is no paid period left, so the roles end at once.
  const endsNow = !isInFuture(activeUntil);
  const date = activeUntil && !endsNow ? formatLongDate(activeUntil, i18n.language) : '';
  const variant = endsNow ? 'now' : 'later';

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: rolesKeys.mine });
    void queryClient.invalidateQueries({ queryKey: profileKeys.me });
  };

  const disableMutation = useMutation({
    mutationKey: ['settings', 'coachAccount', 'disable'],
    mutationFn: disableCoachAccount,
    // The Identity roles stay in the JWT, so the tokens and the auth store are left alone.
    onSuccess: (result) => {
      refresh();
      showSuccess(result.rolesRemoved.length > 0 ? 'settings.disableDialog.endedToast' : 'settings.disableDialog.scheduledToast');
      setErrorMessage(null);
      onClose();
    },
    onError: (error) => {
      setErrorMessage(getApiErrorMessage(error, 'settings.disableDialog.error'));
      // A stale tab: the roles are already gone server-side, so refresh what the cards show.
      if (getErrorCode(error) === 'NO_ACTIVE_COACH_ROLE') refresh();
    },
  });

  const close = () => {
    if (disableMutation.isPending) return;
    setErrorMessage(null);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && close()}>
      <DialogContent className="max-w-125 gap-5 rounded-xl px-7 pt-6.5 pb-6 sm:max-w-125">
        <DialogHeader className="flex-row items-start gap-3.5 text-left">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-error/10 text-error">
            <Power className="size-4.5" aria-hidden="true" />
          </span>
          <div className="flex flex-col gap-1.25">
            <DialogTitle className="text-auth-title leading-tight">{t('settings.disableDialog.title')}</DialogTitle>
            <DialogDescription className="text-copy leading-normal">
              {t('settings.disableDialog.description', { roles: roleNames })}
            </DialogDescription>
          </div>
        </DialogHeader>

        <ul className="flex flex-col gap-4">
          <Row
            icon={<CalendarDays className="size-4" aria-hidden="true" />}
            title={t(`settings.disableDialog.${variant}.untilTitle`, { date })}
          >
            {t(`settings.disableDialog.${variant}.untilBody`)}
          </Row>
          <Row icon={<CreditCard className="size-4" aria-hidden="true" />} title={t('settings.disableDialog.chargesTitle')}>
            {t(`settings.disableDialog.${variant}.chargesBody`)}
          </Row>
          <Row icon={<CirclePlay className="size-4" aria-hidden="true" />} title={t('settings.disableDialog.plansTitle')}>
            {t(`settings.disableDialog.${variant}.plansBody`, { date })}
          </Row>
          <Row icon={<Lock className="size-4" aria-hidden="true" />} title={t('settings.disableDialog.readOnlyTitle')}>
            {t('settings.disableDialog.readOnlyBody')}
          </Row>
        </ul>

        <div className="flex gap-2.5 rounded-xl bg-sunken px-3.5 py-3 text-ink-2">
          <Info className="mt-px size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <p className="text-body leading-normal">{t('settings.disableDialog.footnote')}</p>
        </div>

        {errorMessage && (
          <p role="alert" className="text-body text-error">
            {errorMessage}
          </p>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" size="lg" disabled={disableMutation.isPending} onClick={close}>
            {t('settings.disableDialog.keep')}
          </Button>
          <Button
            type="button"
            size="lg"
            disabled={disableMutation.isPending || rolesQuery.isPending}
            onClick={() => {
              setErrorMessage(null);
              disableMutation.mutate();
            }}
            className="bg-error text-primary-foreground hover:bg-error/90"
          >
            {t('settings.disableDialog.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
