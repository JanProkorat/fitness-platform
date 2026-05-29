import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import type { SupplementDto } from '@/api/plan-types';

const supplementSchema = z.object({
  name: z
    .string()
    .min(1, { message: 'required' })
    .max(100, { message: 'tooLong' }),
  dose: z.string().max(200, { message: 'tooLong' }).optional().or(z.literal('')),
  notes: z.string().max(500, { message: 'tooLong' }).optional().or(z.literal('')),
});

type SupplementFormValues = z.infer<typeof supplementSchema>;

interface SupplementEditorDialogProps {
  open: boolean;
  supplement: SupplementDto | null;
  onSave: (values: { name: string; dose: string | null; notes: string | null }) => void;
  onClose: () => void;
}

export function SupplementEditorDialog({
  open,
  supplement,
  onSave,
  onClose,
}: SupplementEditorDialogProps) {
  const { t } = useTranslation();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<SupplementFormValues>({
    resolver: zodResolver(supplementSchema),
    defaultValues: { name: '', dose: '', notes: '' },
  });

  // Reset form when the dialog opens with new supplement data
  useEffect(() => {
    if (open) {
      reset({
        name: supplement?.name ?? '',
        dose: supplement?.dose ?? '',
        notes: supplement?.notes ?? '',
      });
    }
  }, [open, supplement, reset]);

  const onSubmit = (values: SupplementFormValues) => {
    onSave({
      name: values.name,
      dose: values.dose?.trim() || null,
      notes: values.notes?.trim() || null,
    });
  };

  const getNameError = () => {
    if (!errors.name) return undefined;
    if (errors.name.message === 'required') return t('nutrition.supplements.form.name.required');
    if (errors.name.message === 'tooLong') return t('nutrition.supplements.form.name.tooLong');
    return errors.name.message;
  };

  const getDoseError = () => {
    if (!errors.dose) return undefined;
    if (errors.dose.message === 'tooLong') return t('nutrition.supplements.form.dose.tooLong');
    return errors.dose.message;
  };

  const getNotesError = () => {
    if (!errors.notes) return undefined;
    if (errors.notes.message === 'tooLong') return t('nutrition.supplements.form.notes.tooLong');
    return errors.notes.message;
  };

  const isEditing = supplement !== null;
  const title = isEditing
    ? t('nutrition.supplements.editButton')
    : t('nutrition.supplements.addButton');

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      maxWidth={440}
      footer={
        <>
          <Button type="button" variant="default" onClick={onClose}>
            {t('nutrition.supplements.form.cancel')}
          </Button>
          <Button type="submit" variant="primary" form="supplement-editor-form">
            {t('nutrition.supplements.form.save')}
          </Button>
        </>
      }
    >
      <form id="supplement-editor-form" onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <Input
          label={t('nutrition.supplements.form.name.label')}
          placeholder={t('nutrition.supplements.form.name.placeholder')}
          error={getNameError()}
          autoFocus
          {...register('name')}
        />
        <Input
          label={t('nutrition.supplements.form.dose.label')}
          placeholder={t('nutrition.supplements.form.dose.placeholder')}
          error={getDoseError()}
          {...register('dose')}
        />
        <div className="flex flex-col gap-1.5">
          <label className="block text-xs font-medium text-text2">
            {t('nutrition.supplements.form.notes.label')}
          </label>
          <textarea
            className="w-full py-[7px] px-2.5 border border-border-md rounded-md text-[13px] text-text bg-bg font-[inherit] transition-colors duration-150 placeholder:text-text3 focus:outline-none focus:border-border-hv resize-none"
            placeholder={t('nutrition.supplements.form.notes.placeholder')}
            rows={3}
            {...register('notes')}
          />
          {getNotesError() && (
            <p className="text-[11px] text-red">{getNotesError()}</p>
          )}
        </div>
      </form>
    </Dialog>
  );
}
