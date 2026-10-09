import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Dumbbell, Info, Leaf, Plus } from 'lucide-react';
import { addRole, getMyCoachRoles, removeCoachRole, rolesKeys } from '@/api/roles';
import { profileKeys } from '@/api/profile';
import { getApiErrorMessage, getErrorCode, showApiError, showSuccess } from '@/lib/api-errors';
import { cn } from '@/lib/utils';
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
import { Skeleton } from '@/components/ui/skeleton';
import RemoveRoleDialog, { type CoachRoleKey } from '@/components/settings/RemoveRoleDialog';
import SettingsCard from '@/components/settings/SettingsCard';

/** Roles a user can hold from here; the string is the value the roles endpoints expect. */
const COACH_ROLES = [
  { key: 'trainer', apiRole: 'Trainer', Icon: Dumbbell, tint: 'bg-sunken text-ink' },
  { key: 'nutritionist', apiRole: 'Nutritionist', Icon: Leaf, tint: 'bg-nutrition-soft text-nutrition' },
] as const;

interface RemoveTarget {
  key: CoachRoleKey;
  apiRole: string;
  /** Counts read from GET /users/me/roles at the moment the dialog opened, i.e. before the removal. */
  clientCount: number;
  sharedWithOtherRoleCount: number;
}

export default function RolesCard() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [pendingRole, setPendingRole] = useState<(typeof COACH_ROLES)[number] | null>(null);
  const [removeTarget, setRemoveTarget] = useState<RemoveTarget | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);

  const rolesQuery = useQuery({ queryKey: rolesKeys.mine, queryFn: getMyCoachRoles });
  const summaries = rolesQuery.data ?? [];

  const summaryFor = (key: string) => summaries.find((summary) => summary.role.toLowerCase() === key);
  const heldRoles = COACH_ROLES.filter((role) => summaryFor(role.key));
  // A removed role is not in the active list, so it is offered here again.
  const missingRoles = COACH_ROLES.filter((role) => !summaryFor(role.key));
  // Only a coach can self-assign the other coach role (POST /users/me/roles is gated on them).
  const canAdd = heldRoles.length > 0 && missingRoles.length > 0;
  const onlyRole = heldRoles.length === 1;

  const addMutation = useMutation({
    mutationKey: ['settings', 'roles', 'add'],
    mutationFn: (apiRole: string) => addRole(apiRole),
    onSuccess: (result) => {
      const { user: current, setTokens, setUser } = useAuthStore.getState();
      // The JWT carries the roles, so the fresh pair must replace the old one before the next request.
      setTokens(result.accessToken, result.refreshToken);
      if (current) {
        setUser({ ...current, roles: [...new Set([...current.roles, result.addedRole])] });
      }
      void queryClient.invalidateQueries({ queryKey: rolesKeys.mine });
      void queryClient.invalidateQueries({ queryKey: profileKeys.me });
      showSuccess('settings.roles.added');
      setPendingRole(null);
    },
    onError: (error) => {
      showApiError(error, 'settings.roles.addError');
      setPendingRole(null);
    },
  });

  const removeMutation = useMutation({
    mutationKey: ['settings', 'roles', 'remove'],
    mutationFn: (apiRole: string) => removeCoachRole(apiRole),
    // The Identity role stays in the JWT after a removal, so the tokens and the auth store are left alone.
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: rolesKeys.mine });
      void queryClient.invalidateQueries({ queryKey: profileKeys.me });
      showSuccess('settings.roles.removed');
      setRemoveTarget(null);
      setRemoveError(null);
    },
    onError: (error) => {
      setRemoveError(getApiErrorMessage(error, 'settings.roles.removeError'));
      // A stale tab: the role is already gone server-side, so refresh what the card shows.
      if (getErrorCode(error) === 'ROLE_NOT_ASSIGNED') {
        void queryClient.invalidateQueries({ queryKey: rolesKeys.mine });
      }
    },
  });

  const closeRemoveDialog = () => {
    setRemoveTarget(null);
    setRemoveError(null);
  };

  return (
    <SettingsCard
      title={t('settings.roles.title')}
      description={t('settings.roles.description')}
      action={
        canAdd && (
          <Button
            type="button"
            variant="outline"
            className="h-8.5 gap-1.75 rounded-field bg-sunken px-3.5 font-semibold text-muted-foreground"
            onClick={() => setPendingRole(missingRoles[0] ?? null)}
          >
            <Plus className="size-3.75" aria-hidden="true" />
            {t('settings.roles.add')}
          </Button>
        )
      }
    >
      {rolesQuery.isPending ? (
        <Skeleton className="h-32 w-full rounded-lg" />
      ) : rolesQuery.isError ? (
        <p role="alert" className="text-body text-error">
          {t('settings.roles.loadError')}
        </p>
      ) : (
        <>
          <ul className="border-y border-border">
            {heldRoles.map(({ key, apiRole, Icon, tint }) => {
              const summary = summaryFor(key);
              return (
                <li key={key} className="flex items-center gap-3.5 border-b border-border px-1 py-3.5 last:border-b-0">
                  <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-field', tint)}>
                    <Icon className="size-4.5" aria-hidden="true" />
                  </span>
                  <div className="flex min-w-0 flex-col gap-0.75">
                    <span className="flex items-center gap-2">
                      <span className="text-copy font-semibold text-ink">{t(`roles.${key}`)}</span>
                      <span className="inline-flex h-5.5 items-center gap-1.25 rounded-full bg-nutrition-soft px-2 text-label font-semibold text-nutrition-ink">
                        <span className="size-1.5 rounded-full bg-nutrition" aria-hidden="true" />
                        {t('settings.roles.active')}
                      </span>
                    </span>
                    <span className="text-body text-muted-foreground">{t(`settings.roles.descriptions.${key}`)}</span>
                  </div>
                  <span className="ml-auto text-body font-medium whitespace-nowrap text-ink-2">
                    {t('settings.roles.clients', { count: summary?.clientCount ?? 0 })}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    // The last role cannot be removed here until disabling the coach account is wired up.
                    disabled={onlyRole}
                    title={onlyRole ? t('shell.comingSoon') : undefined}
                    className="h-8.5 shrink-0 rounded-field px-3 font-semibold text-error"
                    onClick={() =>
                      setRemoveTarget({
                        key,
                        apiRole,
                        clientCount: summary?.clientCount ?? 0,
                        sharedWithOtherRoleCount: summary?.sharedWithOtherRoleCount ?? 0,
                      })
                    }
                  >
                    {t('settings.roles.remove')}
                  </Button>
                </li>
              );
            })}
          </ul>
          <div className="flex gap-2.5 rounded-xl bg-sunken px-3.5 py-3 text-ink-2">
            <Info className="mt-px size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <p className="text-body leading-normal">
              {onlyRole ? t('settings.roles.onlyRoleNote') : t('settings.roles.note')}
            </p>
          </div>
        </>
      )}

      <RemoveRoleDialog
        role={removeTarget?.key ?? null}
        clientCount={removeTarget?.clientCount ?? 0}
        sharedWithOtherRoleCount={removeTarget?.sharedWithOtherRoleCount ?? 0}
        pending={removeMutation.isPending}
        errorMessage={removeError}
        onConfirm={() => {
          if (!removeTarget) return;
          setRemoveError(null);
          removeMutation.mutate(removeTarget.apiRole);
        }}
        onClose={closeRemoveDialog}
      />

      <Dialog open={pendingRole !== null} onOpenChange={(open) => !open && setPendingRole(null)}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>
              {t('settings.roles.addDialog.title', { role: pendingRole ? t(`roles.${pendingRole.key}`) : '' })}
            </DialogTitle>
            <DialogDescription>{t('settings.roles.addDialog.body')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" size="lg" onClick={() => setPendingRole(null)}>
              {t('common.cancel')}
            </Button>
            <Button
              type="button"
              size="lg"
              disabled={addMutation.isPending}
              onClick={() => pendingRole && addMutation.mutate(pendingRole.apiRole)}
            >
              {t('settings.roles.add')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SettingsCard>
  );
}
