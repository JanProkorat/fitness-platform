import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { TagInput } from '@/components/ui/tag-input';
import { updateClientNutritionProfile } from '@/api/nutrition-profile';
import type { OnboardingDataDto } from '@/api/generated';
import { showApiError, showSuccess } from '@/lib/api-errors';
import {
  MAX_ALLERGIES_LENGTH,
  MAX_FIBRE_GRAMS,
  MAX_ITEM_LENGTH,
  MAX_PROFILE_ITEMS,
  hasNoTargets,
  nutritionProfileSchema,
  parseFibre,
  splitAllergies,
  type NutritionProfileFormValues,
} from '@/components/client-detail/nutrition/nutritionProfile';

interface Props {
  clientId: string;
  onboarding: OnboardingDataDto;
  open: boolean;
  onClose: () => void;
}

interface FormProps {
  clientId: string;
  onboarding: OnboardingDataDto;
  onClose: () => void;
  onPendingChange: (pending: boolean) => void;
}

type TagField = 'allergies' | 'dislikes' | 'habits';

/** Appends pending tag text to a list the way TagInput's Enter does (trim, case-insensitive dedupe). */
function withPendingTag(list: string[], pending: string): string[] {
  const next = pending.trim();
  if (next === '' || list.some((tag) => tag.toLowerCase() === next.toLowerCase())) return list;
  return [...list, next];
}

function ProfileForm({ clientId, onboarding, onClose, onPendingChange }: FormProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const fibreLocked = hasNoTargets(onboarding);

  const {
    control,
    register,
    handleSubmit,
    getValues,
    setValue,
    formState: { errors },
  } = useForm<NutritionProfileFormValues>({
    resolver: zodResolver(nutritionProfileSchema),
    defaultValues: {
      allergies: splitAllergies(onboarding.allergies),
      dislikes: onboarding.dislikes ?? [],
      habits: onboarding.habits ?? [],
      fibreGrams: onboarding.fibreGrams != null ? String(onboarding.fibreGrams) : '',
    },
  });

  // Text typed into a tag box without Enter lives here so Save can turn it into a tag before validation.
  const [drafts, setDrafts] = useState<Record<TagField, string>>({ allergies: '', dislikes: '', habits: '' });
  const setDraft = (field: TagField) => (value: string) => setDrafts((prev) => ({ ...prev, [field]: value }));

  const saveMutation = useMutation({
    mutationFn: (values: NutritionProfileFormValues) =>
      updateClientNutritionProfile(clientId, {
        allergies: values.allergies,
        dislikes: values.dislikes,
        habits: values.habits,
        fibreGrams: fibreLocked ? undefined : parseFibre(values.fibreGrams),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['client-dashboard', clientId] });
      showSuccess('clientDetail.nutrition.profile.edit.saved');
      onClose();
    },
    onError: (error) => {
      showApiError(error, 'clientDetail.nutrition.profile.edit.saveError');
    },
  });
  const isSaving = saveMutation.isPending;
  useEffect(() => {
    onPendingChange(isSaving);
    return () => onPendingChange(false);
  }, [isSaving, onPendingChange]);

  const allergiesError = errors.allergies?.message;
  const allergiesMessage =
    allergiesError === 'tooLong'
      ? t('clientDetail.nutrition.profile.edit.allergiesTooLong', { max: MAX_ALLERGIES_LENGTH })
      : errors.allergies
        ? t('clientDetail.nutrition.profile.edit.allergiesInvalid')
        : undefined;

  function submit(event: React.FormEvent<HTMLFormElement>) {
    for (const field of ['allergies', 'dislikes', 'habits'] as const) {
      if (drafts[field].trim() === '') continue;
      setValue(field, withPendingTag(getValues(field), drafts[field]));
    }
    setDrafts({ allergies: '', dislikes: '', habits: '' });
    // Validation runs after the merge, so a too-long pending tag is rejected like a typed one.
    void handleSubmit((values) => saveMutation.mutate(values))(event);
  }

  return (
    <form onSubmit={submit} className="grid gap-4" noValidate>
      <DialogHeader>
        <DialogTitle>{t('clientDetail.nutrition.profile.edit.title')}</DialogTitle>
        <DialogDescription>{t('clientDetail.nutrition.profile.edit.description')}</DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="nutrition-profile-allergies">{t('clientDetail.nutrition.profile.allergies')}</Label>
        <Controller
          control={control}
          name="allergies"
          render={({ field }) => (
            <TagInput
              id="nutrition-profile-allergies"
              draft={drafts.allergies}
              onDraftChange={setDraft('allergies')}
              value={field.value}
              onChange={field.onChange}
              invalid={Boolean(errors.allergies)}
              placeholder={t('clientDetail.nutrition.profile.edit.addPlaceholder')}
              removeLabel={(tag) => t('clientDetail.nutrition.profile.edit.remove', { name: tag })}
            />
          )}
        />
        {allergiesMessage && (
          <p role="alert" className="text-meta text-destructive">
            {allergiesMessage}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="nutrition-profile-dislikes">{t('clientDetail.nutrition.profile.dislikes')}</Label>
        <Controller
          control={control}
          name="dislikes"
          render={({ field }) => (
            <TagInput
              id="nutrition-profile-dislikes"
              draft={drafts.dislikes}
              onDraftChange={setDraft('dislikes')}
              value={field.value}
              onChange={field.onChange}
              invalid={Boolean(errors.dislikes)}
              placeholder={t('clientDetail.nutrition.profile.edit.addPlaceholder')}
              removeLabel={(tag) => t('clientDetail.nutrition.profile.edit.remove', { name: tag })}
            />
          )}
        />
        {errors.dislikes && (
          <p role="alert" className="text-meta text-destructive">
            {t('clientDetail.nutrition.profile.edit.listInvalid', { count: MAX_PROFILE_ITEMS, length: MAX_ITEM_LENGTH })}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="nutrition-profile-habits">{t('clientDetail.nutrition.profile.habits')}</Label>
        <Controller
          control={control}
          name="habits"
          render={({ field }) => (
            <TagInput
              id="nutrition-profile-habits"
              draft={drafts.habits}
              onDraftChange={setDraft('habits')}
              value={field.value}
              onChange={field.onChange}
              invalid={Boolean(errors.habits)}
              placeholder={t('clientDetail.nutrition.profile.edit.addPlaceholder')}
              removeLabel={(tag) => t('clientDetail.nutrition.profile.edit.remove', { name: tag })}
            />
          )}
        />
        {errors.habits && (
          <p role="alert" className="text-meta text-destructive">
            {t('clientDetail.nutrition.profile.edit.listInvalid', { count: MAX_PROFILE_ITEMS, length: MAX_ITEM_LENGTH })}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="nutrition-profile-fibre">{t('clientDetail.nutrition.profile.edit.fibre')}</Label>
        <Input
          id="nutrition-profile-fibre"
          type="number"
          inputMode="decimal"
          step="any"
          min={0}
          max={MAX_FIBRE_GRAMS}
          disabled={fibreLocked}
          aria-invalid={Boolean(errors.fibreGrams)}
          aria-describedby="nutrition-profile-fibre-hint"
          className="h-10"
          {...register('fibreGrams')}
        />
        <p id="nutrition-profile-fibre-hint" className="text-meta text-muted-foreground">
          {fibreLocked
            ? t('clientDetail.nutrition.profile.edit.fibreNoTargets')
            : t('clientDetail.nutrition.profile.edit.fibreHint', { max: MAX_FIBRE_GRAMS })}
        </p>
        {errors.fibreGrams && (
          <p role="alert" className="text-meta text-destructive">
            {t('clientDetail.nutrition.profile.edit.fibreInvalid', { max: MAX_FIBRE_GRAMS })}
          </p>
        )}
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose} disabled={saveMutation.isPending}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" disabled={saveMutation.isPending}>
          {t('clientDetail.nutrition.profile.edit.submit')}
        </Button>
      </DialogFooter>
    </form>
  );
}

/** Dialog to edit allergies, dislikes, habits and the fibre target of a client's nutrition profile. */
export default function EditNutritionProfileDialog({ clientId, onboarding, open, onClose }: Props) {
  // The form reports its save state so the dialog can refuse to close mid-request.
  const [saving, setSaving] = useState(false);

  return (
    <Dialog open={open} onOpenChange={(next) => !next && !saving && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <ProfileForm clientId={clientId} onboarding={onboarding} onClose={onClose} onPendingChange={setSaving} />
      </DialogContent>
    </Dialog>
  );
}
