import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useCreateClientTag } from '@/hooks/useClientsQueries';
import type { ClientTagDto } from '@/api/client-tags';

interface FormValues {
  name: string;
  colorHex: string;
  description: string;
}

const DEFAULT_COLOR = '#3b82f6';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after the tag is created, so a per-row caller can auto-assign it. */
  onCreated?: (tag: ClientTagDto) => void;
}

/**
 * Inline tag-creation modal, opened from a row's tag picker (see
 * ClientTagPickerPopover). `colorHex` is per-coach runtime data, not a
 * design token — same carve-out as ClientTagPill's own inline style
 * (rules/code-style.md#design-tokens-over-hardcoded-values).
 */
export default function CreateTagDialog({ open, onOpenChange, onCreated }: Props) {
  const { t } = useTranslation();

  const schema = z.object({
    name: z.string().min(1, t('clients.tagPicker.validation.nameRequired')).max(50),
    colorHex: z.string().min(1),
    description: z.string().max(200),
  });

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isValid },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: 'onTouched',
    defaultValues: { name: '', colorHex: DEFAULT_COLOR, description: '' },
  });

  const colorHex = watch('colorHex');
  const createMutation = useCreateClientTag();

  // Reset to a clean slate each time the modal opens, so a cancelled create
  // doesn't leave stale text behind for the next row that opens it.
  useEffect(() => {
    if (open) {
      reset({ name: '', colorHex: DEFAULT_COLOR, description: '' });
    }
  }, [open, reset]);

  function onSubmit(values: FormValues) {
    createMutation.mutate(
      { name: values.name, colorHex: values.colorHex, description: values.description || undefined },
      {
        onSuccess: (tag) => {
          onCreated?.(tag);
          onOpenChange(false);
        },
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('clients.tagPicker.createTitle')}</DialogTitle>
          <DialogDescription>{t('clients.tagPicker.createDescription')}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tag-name">{t('clients.tagPicker.nameLabel')}</Label>
            <Input id="tag-name" aria-invalid={!!errors.name} {...register('name')} />
            {errors.name && <p className="text-meta text-destructive">{errors.name.message}</p>}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tag-color">{t('clients.tagPicker.colorLabel')}</Label>
            <input
              id="tag-color"
              type="color"
              value={colorHex}
              onChange={(event) => setValue('colorHex', event.target.value, { shouldValidate: true })}
              className="h-9 w-16 cursor-pointer rounded-md border border-input bg-background p-1"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tag-description">{t('clients.tagPicker.descriptionLabel')}</Label>
            <Textarea id="tag-description" {...register('description')} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={!isValid || createMutation.isPending}>
              {createMutation.isPending ? t('common.saving') : t('clients.tagPicker.createSubmit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
