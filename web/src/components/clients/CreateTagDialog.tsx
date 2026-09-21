import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { RadioGroup as RadioGroupPrimitive } from 'radix-ui';
import { Tag as TagIcon } from 'lucide-react';
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

const HEX_PATTERN = /^#[0-9a-fA-F]{6}$/;

/**
 * The eight preset swatches offered in the color picker. `colorHex` is
 * per-coach runtime data written into the create-tag request body, not a
 * design token — same carve-out as `ClientTagPill`'s own inline style
 * (rules/code-style.md#design-tokens-over-hardcoded-values). Values sampled
 * from the design target (docs/design/1083/create-tag-inventory.md); stored
 * lowercase here, the backend lowercases the submitted value regardless.
 */
const TAG_COLOR_PRESETS = [
  { hex: '#ef4444', labelKey: 'red' },
  { hex: '#f97316', labelKey: 'orange' },
  { hex: '#eab308', labelKey: 'yellow' },
  { hex: '#10b981', labelKey: 'green' },
  { hex: '#3b82f6', labelKey: 'blue' },
  { hex: '#8b5cf6', labelKey: 'purple' },
  { hex: '#ec4899', labelKey: 'pink' },
  { hex: '#64748b', labelKey: 'grey' },
] as const;

// The blue preset, uppercased — the form's default before the coach picks a
// colour. Derived from the preset list rather than duplicated as a separate
// literal, so there is one source for this value, not two spellings of it.
const DEFAULT_COLOR = TAG_COLOR_PRESETS[4].hex.toUpperCase();

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after the tag is created, so a per-row caller can auto-assign it. */
  onCreated?: (tag: ClientTagDto) => void;
}

/**
 * Inline tag-creation modal, opened from a row's tag picker (see
 * ClientTagPickerPopover).
 */
export default function CreateTagDialog({ open, onOpenChange, onCreated }: Props) {
  const { t } = useTranslation();

  const schema = z.object({
    name: z.string().min(1, t('clients.tagPicker.validation.nameRequired')).max(50),
    colorHex: z.string().regex(HEX_PATTERN, t('clients.tagPicker.validation.colorInvalid')),
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

  // Holds the last colour that parsed as valid hex, so the preview pill
  // never renders unstyled or blank while the user is mid-edit on a bad hex.
  const [lastValidColor, setLastValidColor] = useState(DEFAULT_COLOR);

  useEffect(() => {
    if (HEX_PATTERN.test(colorHex)) {
      setLastValidColor(colorHex);
    }
  }, [colorHex]);

  // Reset to a clean slate each time the modal opens, so a cancelled create
  // doesn't leave stale text (or a stale preview colour) behind for the next
  // row that opens it.
  useEffect(() => {
    if (open) {
      reset({ name: '', colorHex: DEFAULT_COLOR, description: '' });
      setLastValidColor(DEFAULT_COLOR);
    }
  }, [open, reset]);

  // Case-insensitive match against the preset list. A valid hex matching no
  // preset (e.g. a custom typed colour) is correct behaviour — no swatch
  // should light up, and the radio group naturally shows nothing checked
  // when its `value` doesn't equal any item's `value`.
  const selectedPresetHex = TAG_COLOR_PRESETS.find(
    (preset) => preset.hex.toLowerCase() === colorHex.toLowerCase(),
  )?.hex;

  // Radix autofocuses the first focusable descendant (`#tag-name`) on mount.
  // A mousedown on a swatch then blurs that input, and `mode: 'onTouched'`
  // validates it — the dialog grows to fit the "required" message, which
  // (being vertically centred) shifts the swatch row out from under the
  // pointer before `click` fires, so the first swatch press is silently
  // lost. Move focus to the dialog's own container instead — Radix's
  // FocusScope dispatches this event on that container, which already
  // carries `tabIndex={-1}`, so `.focus()` doesn't need an extra ref. Tab
  // from there still reaches the name field first, so nothing is lost for
  // keyboard users.
  function handleOpenAutoFocus(event: Event) {
    event.preventDefault();
    (event.target as HTMLElement).focus();
  }

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
      <DialogContent onOpenAutoFocus={handleOpenAutoFocus}>
        <DialogHeader>
          <DialogTitle>{t('clients.tagPicker.createTitle')}</DialogTitle>
          <DialogDescription>{t('clients.tagPicker.createDescription')}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tag-name">{t('clients.tagPicker.nameLabel')}</Label>
            <Input
              id="tag-name"
              placeholder={t('clients.tagPicker.namePlaceholder')}
              aria-invalid={!!errors.name}
              {...register('name')}
            />
            {errors.name && <p className="text-meta text-destructive">{errors.name.message}</p>}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tag-description">{t('clients.tagPicker.descriptionLabel')}</Label>
            <Textarea
              id="tag-description"
              placeholder={t('clients.tagPicker.descriptionPlaceholder')}
              {...register('description')}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label id="tag-color-label">{t('clients.tagPicker.colorLabel')}</Label>
            <RadioGroupPrimitive.Root
              value={selectedPresetHex ?? ''}
              onValueChange={(value) =>
                setValue('colorHex', value.toUpperCase(), { shouldValidate: true, shouldTouch: true })
              }
              orientation="horizontal"
              aria-labelledby="tag-color-label"
              className="flex items-center gap-2"
            >
              {TAG_COLOR_PRESETS.map((preset) => (
                <RadioGroupPrimitive.Item
                  key={preset.hex}
                  value={preset.hex}
                  aria-label={t(`clients.tagPicker.colors.${preset.labelKey}`)}
                  className="size-[18px] shrink-0 cursor-pointer rounded-full border-2 border-transparent outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 data-[state=checked]:border-foreground"
                  style={{ backgroundColor: preset.hex }}
                />
              ))}
            </RadioGroupPrimitive.Root>
            <Input
              id="tag-color"
              aria-label={t('clients.tagPicker.colorLabel')}
              aria-invalid={!!errors.colorHex}
              {...register('colorHex')}
            />
            {errors.colorHex && <p className="text-meta text-destructive">{errors.colorHex.message}</p>}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>{t('clients.tagPicker.previewLabel')}</Label>
            <div className="rounded-md border border-border bg-muted p-3">
              <span
                className="inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-caption font-medium"
                style={{ backgroundColor: `${lastValidColor}1a`, color: lastValidColor }}
              >
                <TagIcon className="size-3 shrink-0" aria-hidden="true" />
                {t('clients.tagPicker.previewSampleName')}
              </span>
            </div>
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
