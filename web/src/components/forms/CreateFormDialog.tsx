import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { QuestionnaireType } from '@/api/questionnaires';
import { useCreateForm } from '@/hooks/useQuestionnaireQueries';
import { getErrorStatus } from '@/lib/api-errors';
import FormTypePicker from '@/components/forms/FormTypePicker';
import { DESCRIPTION_MAX_LENGTH } from '@/components/forms/builder/form-builder-model';

const TITLE_MAX_LENGTH = 200;

const formSchema = z.object({
  title: z.string().trim().min(1).max(TITLE_MAX_LENGTH),
  description: z.string().max(DESCRIPTION_MAX_LENGTH),
  type: z.enum(QuestionnaireType),
});

type FormValues = z.infer<typeof formSchema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function CreateFormBody({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const createMutation = useCreateForm();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setValue,
    control,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    // Validate on submit only: an error <p> appearing on blur would shift the centred dialog under the cursor and swallow the click on X.
    mode: 'onSubmit',
    defaultValues: { title: '', description: '', type: QuestionnaireType.Onboarding },
  });
  const type = useWatch({ control, name: 'type' });

  function onValid(values: FormValues) {
    setServerError(null);
    const description = values.description.trim();
    createMutation.mutate(
      { title: values.title.trim(), description: description === '' ? undefined : description, type: values.type },
      {
        onSuccess: (created) => {
          onClose();
          navigate(`/forms/${created.publicId}`);
        },
        onError: (error) => {
          setServerError(getErrorStatus(error) === 400 ? t('forms.create.invalid') : t('forms.create.error'));
        },
      },
    );
  }

  return (
    <form onSubmit={handleSubmit(onValid)} className="flex flex-col gap-5" noValidate>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="form-title">
          {t('forms.create.title')} <span className="text-destructive">*</span>
        </Label>
        <Input
          id="form-title"
          {...register('title')}
          aria-invalid={!!errors.title}
          aria-describedby={errors.title ? 'form-title-error' : undefined}
          placeholder={t('forms.create.titlePlaceholder')}
          autoComplete="off"
        />
        {errors.title && (
          <p id="form-title-error" role="alert" className="text-meta text-destructive">
            {t('forms.create.titleInvalid', { max: TITLE_MAX_LENGTH })}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="form-description">{t('forms.create.description')}</Label>
        <Textarea
          id="form-description"
          {...register('description')}
          aria-invalid={!!errors.description}
          placeholder={t('forms.create.descriptionPlaceholder')}
          rows={3}
        />
        {errors.description && (
          <p role="alert" className="text-meta text-destructive">
            {t('forms.create.descriptionInvalid', { max: DESCRIPTION_MAX_LENGTH })}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <span id="form-type-label" className="text-body font-medium text-ink">
          {t('forms.create.type')}
        </span>
        <FormTypePicker
          value={type}
          onChange={(option) => setValue('type', option, { shouldDirty: true })}
          labelledBy="form-type-label"
        />
      </div>

      {serverError && (
        <p role="alert" className="text-body text-destructive">
          {serverError}
        </p>
      )}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" disabled={createMutation.isPending}>
          {t('forms.create.submit')}
        </Button>
      </DialogFooter>
    </form>
  );
}

/** Dialog that names a new form and picks its type; on success it opens the new form. */
export default function CreateFormDialog({ open, onOpenChange }: Props) {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('forms.create.heading')}</DialogTitle>
          <DialogDescription>{t('forms.create.subtitle')}</DialogDescription>
        </DialogHeader>
        {/* Mounted only while open so every opening starts from a blank form. */}
        {open && <CreateFormBody onClose={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}
