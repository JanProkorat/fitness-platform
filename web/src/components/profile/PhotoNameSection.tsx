import { useRef } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { Upload } from 'lucide-react';
import { requestProfessionalAvatarUploadUrl, confirmProfessionalAvatar, deleteProfessionalAvatar } from '@/api/avatar';
import { profileKeys } from '@/api/profile';
import { showApiError, showError, showSuccess } from '@/lib/api-errors';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import ProfileAvatar from '@/components/profile/ProfileAvatar';
import { Field, ProfileSection } from '@/components/profile/ProfileSection';
import { initialsOf, type ProfileFormValues } from '@/components/profile/profile-form';

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_BYTES = 5 * 1024 * 1024;

interface Props {
  /** The professional avatar, if one was uploaded. Drives the Remove button. */
  professionalAvatarUrl: string | undefined;
  /** The account avatar clients see when no professional avatar is set. */
  userAvatarUrl: string | undefined;
}

export default function PhotoNameSection({ professionalAvatarUrl, userAvatarUrl }: Props) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const {
    register,
    control,
    formState: { errors },
  } = useFormContext<ProfileFormValues>();
  const [firstName, lastName] = useWatch({ control, name: ['firstName', 'lastName'] });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const { uploadUrl, blobUrl } = await requestProfessionalAvatarUploadUrl({
        contentType: file.type,
        sizeBytes: file.size,
      });
      // The presigned URL is signed for this exact content type; no auth header (plain axios, not the app client).
      await axios.put(uploadUrl, file, { headers: { 'Content-Type': file.type } });
      await confirmProfessionalAvatar(blobUrl);
    },
    onSuccess: () => {
      showSuccess('avatar.uploadSuccess');
      void queryClient.invalidateQueries({ queryKey: profileKeys.trainer });
    },
    onError: (error) => showApiError(error, 'avatar.uploadError'),
  });

  const removeMutation = useMutation({
    mutationFn: deleteProfessionalAvatar,
    onSuccess: () => {
      showSuccess('profile.page.photo.removed');
      void queryClient.invalidateQueries({ queryKey: profileKeys.trainer });
    },
    onError: (error) => showApiError(error, 'profile.page.photo.removeError'),
  });

  function handleFile(file: File | undefined) {
    if (!file) return;
    if (!ACCEPTED_TYPES.includes(file.type)) {
      showError('profile.page.photo.badType');
      return;
    }
    if (file.size > MAX_BYTES) {
      showError('profile.page.photo.tooLarge');
      return;
    }
    uploadMutation.mutate(file);
  }

  const busy = uploadMutation.isPending || removeMutation.isPending;

  return (
    <ProfileSection title={t('profile.page.photo.title')} description={t('profile.page.photo.description')}>
      <div className="flex flex-wrap items-center gap-5">
        <ProfileAvatar
          url={professionalAvatarUrl ?? userAvatarUrl}
          initials={initialsOf(firstName ?? '', lastName ?? '')}
          className="size-24 text-stat"
        />
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_TYPES.join(',')}
              className="sr-only"
              tabIndex={-1}
              aria-label={t('profile.page.photo.upload')}
              onChange={(event) => {
                handleFile(event.target.files?.[0]);
                event.target.value = '';
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="gap-1.5 px-3.5 font-semibold"
              disabled={busy}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload aria-hidden="true" />
              {uploadMutation.isPending ? t('profile.page.photo.uploading') : t('profile.page.photo.upload')}
            </Button>
            {professionalAvatarUrl && (
              <Button
                type="button"
                variant="ghost"
                size="lg"
                className="px-2 font-semibold text-error hover:text-error"
                disabled={busy}
                onClick={() => removeMutation.mutate()}
              >
                {t('profile.page.photo.remove')}
              </Button>
            )}
          </div>
          <p className="text-meta text-muted-foreground">{t('profile.page.photo.hint')}</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('profile.firstName')} htmlFor="profile-first-name" error={errors.firstName?.message}>
          <Input
            id="profile-first-name"
            autoComplete="given-name"
            aria-invalid={!!errors.firstName}
            aria-describedby="profile-first-name-message"
            {...register('firstName')}
          />
        </Field>
        <Field label={t('profile.lastName')} htmlFor="profile-last-name" error={errors.lastName?.message}>
          <Input
            id="profile-last-name"
            autoComplete="family-name"
            aria-invalid={!!errors.lastName}
            aria-describedby="profile-last-name-message"
            {...register('lastName')}
          />
        </Field>
      </div>
    </ProfileSection>
  );
}
