import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
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

export interface TagFormValues {
  name: string;
  colorHex: string;
  description: string;
}

/**
 * The eight preset swatches offered in the color picker. `colorHex` is
 * per-coach runtime data written into the create/update-tag request body,
 * not a design token — same carve-out as `TagPill`'s own inline style
 * (rules/code-style.md#design-tokens-over-hardcoded-values). Values sampled
 * from the design target (docs/design/1083/create-tag-inventory.md); stored
 * lowercase here, the backend lowercases the submitted value regardless.
 */
export const TAG_COLOR_PRESETS = [
  { hex: '#ef4444', labelKey: 'red' },
  { hex: '#f97316', labelKey: 'orange' },
  { hex: '#eab308', labelKey: 'yellow' },
  { hex: '#10b981', labelKey: 'green' },
  { hex: '#3b82f6', labelKey: 'blue' },
  { hex: '#8b5cf6', labelKey: 'purple' },
  { hex: '#ec4899', labelKey: 'pink' },
  { hex: '#64748b', labelKey: 'grey' },
] as const;

export type TagColorLabelKey = (typeof TAG_COLOR_PRESETS)[number]['labelKey'];

// The blue preset, uppercased — the form's default before the coach picks a
// colour. Derived from the preset list rather than duplicated as a separate
// literal, so there is one source for this value, not two spellings of it.
export const DEFAULT_TAG_COLOR = TAG_COLOR_PRESETS[4].hex.toUpperCase();

const HEX_PATTERN = /^#[0-9a-fA-F]{6}$/;

const EMPTY_VALUES: TagFormValues = { name: '', colorHex: DEFAULT_TAG_COLOR, description: '' };

/** Every translated string this dialog renders — the caller (a thin
 * per-domain adapter) supplies these so this component carries no i18n
 * namespace assumption of its own. */
export interface TagFormDialogLabels {
  title: string;
  description: string;
  nameLabel: string;
  namePlaceholder: string;
  colorLabel: string;
  descriptionLabel: string;
  descriptionPlaceholder: string;
  previewLabel: string;
  previewSampleName: string;
  submitLabel: string;
  savingLabel: string;
  cancelLabel: string;
  nameRequiredError: string;
  colorInvalidError: string;
  colorPresetLabels: Record<TagColorLabelKey, string>;
}

/** Labels for the optional delete affordance — only rendered when the
 * caller passes both these labels and `onDelete` (edit mode only). Kept out
 * of `TagFormDialogLabels` so a caller with no delete UI (client tags) never
 * has to supply dummy strings for it. */
export interface TagFormDialogDeleteLabels {
  buttonLabel: string;
  confirmTitle: string;
  confirmDescription: string;
  confirmButtonLabel: string;
  cancelLabel: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'create' | 'edit';
  /** Pre-fills the form in edit mode. Ignored (the empty defaults are used) in create mode. */
  initialValues?: TagFormValues;
  isPending: boolean;
  onSubmit: (values: TagFormValues) => void;
  labels: TagFormDialogLabels;
  /** Forwarded to DialogContent's `onCloseAutoFocus`, so a caller that closes its own popover before opening this dialog can redirect focus back to its trigger. */
  onCloseAutoFocus?: (event: Event) => void;
  /** Renders a destructive "Delete" affordance in the footer, behind an
   * inline confirmation step — only in `mode="edit"`. Food tags (#1120) pass
   * this; client tags don't (no delete UI exists for them yet). */
  onDelete?: () => void;
  isDeleting?: boolean;
  deleteLabels?: TagFormDialogDeleteLabels;
}

/**
 * Generalised tag create/edit modal — 8 color presets, live preview,
 * create/edit modes. Shared by client tags (#1083) and food tags (#1120);
 * `CreateTagDialog` (clients) is a thin adapter over this component. Domain
 * wiring (which mutation to call, translated copy) is the caller's job —
 * this component owns only the form/preset/preview shape.
 */
export default function TagFormDialog({
  open,
  onOpenChange,
  mode,
  initialValues,
  isPending,
  onSubmit,
  labels,
  onCloseAutoFocus,
  onDelete,
  isDeleting,
  deleteLabels,
}: Props) {
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const showDelete = mode === 'edit' && Boolean(onDelete) && Boolean(deleteLabels);
  const schema = z.object({
    name: z.string().min(1, labels.nameRequiredError).max(50),
    colorHex: z.string().regex(HEX_PATTERN, labels.colorInvalidError),
    description: z.string().max(200),
  });

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isValid },
  } = useForm<TagFormValues>({
    resolver: zodResolver(schema),
    mode: 'onTouched',
    defaultValues: initialValues ?? EMPTY_VALUES,
  });

  const colorHex = watch('colorHex');

  // Holds the last colour that parsed as valid hex, so the preview pill
  // never renders unstyled or blank while the user is mid-edit on a bad hex.
  const [lastValidColor, setLastValidColor] = useState(initialValues?.colorHex ?? DEFAULT_TAG_COLOR);

  useEffect(() => {
    if (HEX_PATTERN.test(colorHex)) {
      setLastValidColor(colorHex);
    }
  }, [colorHex]);

  // Reset to a clean slate (or the tag being edited) each time the modal
  // opens, so a cancelled edit/create doesn't leave stale text (or a stale
  // preview colour) behind for the next row that opens it.
  useEffect(() => {
    if (open) {
      const next = initialValues ?? EMPTY_VALUES;
      reset(next);
      setLastValidColor(next.colorHex);
    } else {
      // Closing the edit dialog (cancel, or a successful save/delete) must
      // also close the nested delete-confirm dialog — its own `open` state
      // is otherwise untouched by the outer dialog's `open` prop, since it's
      // a second, independent Radix Dialog.Root instance.
      setConfirmDeleteOpen(false);
    }
    // Only re-run on `open` flipping — a fresh `initialValues` object per
    // parent render would otherwise reset the form mid-edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Case-insensitive match against the preset list. A valid hex matching no
  // preset (e.g. a custom typed colour) is correct behaviour — no swatch
  // should light up, and the radio group naturally shows nothing checked
  // when its `value` doesn't equal any item's `value`.
  const selectedPresetHex = TAG_COLOR_PRESETS.find(
    (preset) => preset.hex.toLowerCase() === colorHex.toLowerCase(),
  )?.hex;

  // Default autofocus on #tag-name lets a swatch mousedown blur+validate it
  // before the click lands, so focus the dialog's own container instead.
  function handleOpenAutoFocus(event: Event) {
    event.preventDefault();
    (event.target as HTMLElement).focus();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onOpenAutoFocus={handleOpenAutoFocus} onCloseAutoFocus={onCloseAutoFocus}>
        <DialogHeader>
          <DialogTitle>{labels.title}</DialogTitle>
          <DialogDescription>{labels.description}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tag-name">{labels.nameLabel}</Label>
            <Input
              id="tag-name"
              placeholder={labels.namePlaceholder}
              aria-invalid={!!errors.name}
              {...register('name')}
            />
            {errors.name && <p className="text-meta text-destructive">{errors.name.message}</p>}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tag-description">{labels.descriptionLabel}</Label>
            <Textarea
              id="tag-description"
              placeholder={labels.descriptionPlaceholder}
              {...register('description')}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label id="tag-color-label">{labels.colorLabel}</Label>
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
                  aria-label={labels.colorPresetLabels[preset.labelKey]}
                  className="size-swatch shrink-0 cursor-pointer rounded-full border-2 border-transparent outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 data-[state=checked]:border-foreground"
                  style={{ backgroundColor: preset.hex }}
                />
              ))}
            </RadioGroupPrimitive.Root>
            <Input
              id="tag-color"
              aria-label={labels.colorLabel}
              aria-invalid={!!errors.colorHex}
              {...register('colorHex')}
            />
            {errors.colorHex && <p className="text-meta text-destructive">{errors.colorHex.message}</p>}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>{labels.previewLabel}</Label>
            <div className="rounded-md border border-border bg-muted p-3">
              <span
                className="inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-caption font-medium"
                style={{ backgroundColor: `${lastValidColor}1a`, color: lastValidColor }}
              >
                <TagIcon className="size-3 shrink-0" aria-hidden="true" />
                {labels.previewSampleName}
              </span>
            </div>
          </div>
          <DialogFooter className={showDelete ? 'sm:justify-between' : undefined}>
            {showDelete && (
              <Button
                type="button"
                variant="destructive"
                disabled={isDeleting}
                onClick={() => setConfirmDeleteOpen(true)}
              >
                {deleteLabels!.buttonLabel}
              </Button>
            )}
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {labels.cancelLabel}
              </Button>
              <Button type="submit" disabled={!isValid || isPending}>
                {isPending ? labels.savingLabel : labels.submitLabel}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
      {showDelete && (
        <Dialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{deleteLabels!.confirmTitle}</DialogTitle>
              <DialogDescription>{deleteLabels!.confirmDescription}</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setConfirmDeleteOpen(false)}>
                {deleteLabels!.cancelLabel}
              </Button>
              <Button type="button" variant="destructive" disabled={isDeleting} onClick={onDelete}>
                {deleteLabels!.confirmButtonLabel}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </Dialog>
  );
}
