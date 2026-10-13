import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
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
import { createPlanTemplateFromPlan, LibraryVisibility } from '@/api/nutrition-plan-templates';
import { getErrorStatus, showApiError, showSuccess } from '@/lib/api-errors';

const MAX_NAME_LENGTH = 200;

const formSchema = z.object({
  name: z.string().trim().min(1).max(MAX_NAME_LENGTH),
});

type FormValues = z.infer<typeof formSchema>;

interface Props {
  clientId: string;
  /** The plan being saved; the dialog is closed while this is undefined. */
  plan?: { planId: string; name: string };
  onClose: () => void;
}

/** Small dialog that saves a finished plan as a private template, prefilled with the plan's name. */
export default function SaveAsTemplateDialog({ clientId, plan, onClose }: Props) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: plan?.name ?? '' },
  });

  useEffect(() => {
    if (plan) {
      reset({ name: plan.name });
    }
  }, [plan, reset]);

  const saveMutation = useMutation({
    mutationFn: (values: FormValues) =>
      createPlanTemplateFromPlan({
        planId: plan?.planId ?? '',
        name: values.name.trim(),
        visibility: LibraryVisibility.Private,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['plan-templates'] });
      showSuccess('clientDetail.nutrition.saveTemplate.success');
      onClose();
    },
    onError: (error) => {
      showApiError(error, 'clientDetail.nutrition.saveTemplate.error');
      if (getErrorStatus(error) === 404) {
        void queryClient.invalidateQueries({ queryKey: ['client-plans', clientId] });
        onClose();
      }
    },
  });

  return (
    <Dialog open={Boolean(plan)} onOpenChange={(open) => !open && !saveMutation.isPending && onClose()}>
      <DialogContent className="max-w-md">
        <form onSubmit={handleSubmit((values) => saveMutation.mutate(values))} className="grid gap-4" noValidate>
          <DialogHeader>
            <DialogTitle>{t('clientDetail.nutrition.saveTemplate.title')}</DialogTitle>
            <DialogDescription>{t('clientDetail.nutrition.saveTemplate.description')}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="save-template-name">{t('clientDetail.nutrition.saveTemplate.name')}</Label>
            <Input
              id="save-template-name"
              {...register('name')}
              aria-invalid={Boolean(errors.name)}
              className="h-10"
              autoComplete="off"
            />
            {errors.name && (
              <p role="alert" className="text-meta text-destructive">
                {t('clientDetail.nutrition.saveTemplate.nameInvalid', { max: MAX_NAME_LENGTH })}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={saveMutation.isPending}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={saveMutation.isPending}>
              {t('clientDetail.nutrition.saveTemplate.submit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
