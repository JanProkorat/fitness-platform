import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Dumbbell, Info, Leaf, Plus } from 'lucide-react';
import { addRole } from '@/api/roles';
import { profileKeys } from '@/api/profile';
import { showApiError, showSuccess } from '@/lib/api-errors';
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
import SettingsCard from '@/components/settings/SettingsCard';

/** Roles a user can hold from here; the string is the value POST /users/me/roles expects. */
const COACH_ROLES = [
  { key: 'trainer', apiRole: 'Trainer', Icon: Dumbbell, tint: 'bg-sunken text-ink' },
  { key: 'nutritionist', apiRole: 'Nutritionist', Icon: Leaf, tint: 'bg-nutrition-soft text-nutrition' },
] as const;

export default function RolesCard() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const [pendingRole, setPendingRole] = useState<(typeof COACH_ROLES)[number] | null>(null);

  const held = new Set((user?.roles ?? []).map((role) => role.toLowerCase()));
  const heldRoles = COACH_ROLES.filter((role) => held.has(role.key));
  const missingRoles = COACH_ROLES.filter((role) => !held.has(role.key));
  // Only a coach can self-assign the other coach role (POST /users/me/roles is gated on them).
  const canAdd = heldRoles.length > 0 && missingRoles.length > 0;

  const addMutation = useMutation({
    mutationFn: (apiRole: string) => addRole(apiRole),
    onSuccess: (result) => {
      const { user: current, setTokens, setUser } = useAuthStore.getState();
      // The JWT carries the roles, so the fresh pair must replace the old one before the next request.
      setTokens(result.accessToken, result.refreshToken);
      if (current) {
        setUser({ ...current, roles: [...new Set([...current.roles, result.addedRole])] });
      }
      void queryClient.invalidateQueries({ queryKey: profileKeys.me });
      showSuccess('settings.roles.added');
      setPendingRole(null);
    },
    onError: (error) => {
      showApiError(error, 'settings.roles.addError');
      setPendingRole(null);
    },
  });

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
      <ul className="border-y border-border">
        {heldRoles.map(({ key, Icon, tint }) => (
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
            <Button
              type="button"
              variant="outline"
              disabled
              title={t('shell.comingSoon')}
              className="ml-auto h-8.5 shrink-0 rounded-field px-3 font-semibold text-error"
            >
              {t('settings.roles.remove')}
            </Button>
          </li>
        ))}
      </ul>
      <div className="flex gap-2.5 rounded-xl bg-sunken px-3.5 py-3 text-ink-2">
        <Info className="mt-px size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <p className="text-body leading-normal">{t('settings.roles.note')}</p>
      </div>

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
