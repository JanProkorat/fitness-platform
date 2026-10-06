import { useEffect, useRef, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Check } from 'lucide-react';
import type { GetProfessionalProfileResponse, GetProfileResponse } from '@/api/generated';
import {
  getMyProfile,
  profileKeys,
  updateMyProfile,
  updateMyTimeZone,
  updateTrainerProfile,
} from '@/api/profile';
import { useAuthStore } from '@/stores/auth';
import { getApiErrorMessage, getErrorCode, showApiError, showSuccess } from '@/lib/api-errors';
import { Button } from '@/components/ui/button';
import PhotoNameSection from '@/components/profile/PhotoNameSection';
import AccountSection from '@/components/profile/AccountSection';
import AboutSection from '@/components/profile/AboutSection';
import ExpertiseSection from '@/components/profile/ExpertiseSection';
import CollaborationSection from '@/components/profile/CollaborationSection';
import LinksSection from '@/components/profile/LinksSection';
import VisibilitySection from '@/components/profile/VisibilitySection';
import ProfilePreviewCard from '@/components/profile/ProfilePreviewCard';
import ProfileHeader from '@/components/profile/ProfileHeader';
import {
  buildDefaultValues,
  buildTrainerPayload,
  createProfileSchema,
  fieldForBackendName,
  type ProfileFormValues,
} from '@/components/profile/profile-form';

interface Props {
  me: GetProfileResponse;
  trainer: GetProfessionalProfileResponse;
}

/** Which part of the save a baseline key tracks; each is its own request. */
interface Baseline {
  account: string;
  timeZone: string;
  trainer: string;
}

interface SaveResult {
  values: ProfileFormValues;
  failures: { part: keyof Baseline; error: unknown }[];
  accountSaved: boolean;
}

interface BackendFieldError {
  name?: string;
  code?: string;
  reason?: string;
}

function accountKey(values: ProfileFormValues): string {
  return JSON.stringify([values.firstName.trim(), values.lastName.trim(), values.phoneNumber.trim()]);
}

function computeBaseline(values: ProfileFormValues, legacySpecialization: string | undefined): Baseline {
  return {
    account: accountKey(values),
    timeZone: values.timeZone,
    trainer: JSON.stringify(buildTrainerPayload(values, legacySpecialization)),
  };
}

/** Validator errors as FastEndpoints sends them: `errors: [{ name, reason, code }]`. */
function readBackendErrors(error: unknown): BackendFieldError[] {
  const body = (error as { response?: { data?: { errors?: unknown } } } | null)?.response?.data;
  const direct = (error as { errors?: unknown } | null)?.errors;
  const list = Array.isArray(body?.errors) ? body.errors : Array.isArray(direct) ? direct : [];
  return list as BackendFieldError[];
}

/** The profile editor: form state, save orchestration and the two-column layout. */
export default function ProfileForm({ me, trainer }: Props) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const setUser = useAuthStore((s) => s.setUser);

  // Seeded once: the form owns its values after mount, so a background refetch never overwrites typing.
  const [initialValues] = useState(() => buildDefaultValues(me, trainer));
  const baseline = useRef<Baseline>(computeBaseline(initialValues, trainer.specialization));
  const schema = createProfileSchema(t);

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(schema),
    defaultValues: initialValues,
  });
  const { handleSubmit, reset, setError, formState } = form;

  useEffect(() => {
    if (!formState.isDirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [formState.isDirty]);

  function applyFailure(part: keyof Baseline, error: unknown) {
    const code = getErrorCode(error);
    if (part === 'timeZone' || code === 'INVALID_TIME_ZONE') {
      setError('timeZone', { message: t('profile.page.validation.invalidTimeZone') });
      return;
    }
    let mapped = false;
    for (const entry of readBackendErrors(error)) {
      const field = fieldForBackendName(entry.name);
      const isCertificates = entry.code === 'INVALID_CERTIFICATES' || field === 'certificates';
      const target = isCertificates ? 'certificates' : field;
      if (!target) continue;
      const message = isCertificates
        ? t('profile.page.validation.invalidCertificates')
        : getApiErrorMessage(error, 'profile.page.validation.serverInvalid');
      setError(target, { message });
      mapped = true;
    }
    if (!mapped) showApiError(error, 'profile.saveError');
  }

  const saveMutation = useMutation({
    mutationFn: async (values: ProfileFormValues): Promise<SaveResult> => {
      const next = computeBaseline(values, trainer.specialization);
      const failures: SaveResult['failures'] = [];
      let accountSaved = false;

      if (next.account !== baseline.current.account) {
        try {
          await updateMyProfile({
            firstName: values.firstName.trim(),
            lastName: values.lastName.trim(),
            phoneNumber: values.phoneNumber.trim() === '' ? null : values.phoneNumber.trim(),
          });
          baseline.current = { ...baseline.current, account: next.account };
          accountSaved = true;
        } catch (error) {
          failures.push({ part: 'account', error });
        }
      }
      if (next.timeZone !== baseline.current.timeZone && values.timeZone) {
        try {
          await updateMyTimeZone(values.timeZone);
          baseline.current = { ...baseline.current, timeZone: next.timeZone };
        } catch (error) {
          failures.push({ part: 'timeZone', error });
        }
      }
      if (next.trainer !== baseline.current.trainer) {
        try {
          await updateTrainerProfile(buildTrainerPayload(values, trainer.specialization));
          baseline.current = { ...baseline.current, trainer: next.trainer };
        } catch (error) {
          failures.push({ part: 'trainer', error });
        }
      }
      return { values, failures, accountSaved };
    },
    onSuccess: async ({ values, failures, accountSaved }) => {
      if (accountSaved) {
        // The sidebar card reads the auth store, not the query cache.
        try {
          const profile = await getMyProfile();
          const current = useAuthStore.getState().user;
          if (current) {
            setUser({
              ...current,
              firstName: profile.firstName ?? current.firstName,
              lastName: profile.lastName ?? current.lastName,
              avatarBlobUrl: profile.avatarBlobUrl ?? null,
            });
          }
        } catch {
          // The saved values are on the server; the sidebar catches up on the next session restore.
        }
      }
      void queryClient.invalidateQueries({ queryKey: profileKeys.me });
      void queryClient.invalidateQueries({ queryKey: profileKeys.trainer });

      if (failures.length === 0) {
        reset(values);
        showSuccess('profile.page.saved');
        return;
      }
      for (const { part, error } of failures) applyFailure(part, error);
    },
    onError: (error) => showApiError(error, 'profile.saveError'),
  });

  const isDirty = formState.isDirty;

  return (
    <FormProvider {...form}>
      <form
        noValidate
        onSubmit={handleSubmit((values) => saveMutation.mutate(values))}
        className="flex w-full max-w-6xl flex-col gap-5"
      >
        <ProfileHeader
          actions={
            <>
              <span
                role="status"
                className="flex items-center gap-1.5 text-body text-muted-foreground"
                data-testid="profile-save-state"
              >
                {isDirty ? (
                  t('profile.unsavedChanges')
                ) : (
                  <>
                    <Check className="size-3.5" aria-hidden="true" />
                    {t('profile.page.allSaved')}
                  </>
                )}
              </span>
              <Button
                type="submit"
                size="lg"
                className="px-4 font-semibold"
                disabled={!isDirty || saveMutation.isPending}
              >
                {saveMutation.isPending ? t('common.saving') : t('common.save')}
              </Button>
            </>
          }
        />
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_19rem] xl:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="flex min-w-0 flex-col gap-4">
            <PhotoNameSection professionalAvatarUrl={trainer.avatarBlobUrl} userAvatarUrl={me.avatarBlobUrl} />
            <AccountSection email={me.email ?? ''} />
            <AboutSection />
            <ExpertiseSection />
            <CollaborationSection />
            <LinksSection />
            <VisibilitySection />
          </div>
          <ProfilePreviewCard avatarUrl={trainer.avatarBlobUrl ?? me.avatarBlobUrl} roles={me.roles ?? []} />
        </div>
      </form>
    </FormProvider>
  );
}
