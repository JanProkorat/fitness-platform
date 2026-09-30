import { useTranslation } from 'react-i18next';
import TagFormDialog, { type TagFormValues } from '@/components/tags/TagFormDialog';
import { useCreateClientTag } from '@/hooks/useClientsQueries';
import type { ClientTagDto } from '@/api/client-tags';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after the tag is created, so a per-row caller can auto-assign it. */
  onCreated?: (tag: ClientTagDto) => void;
  /** Forwarded to DialogContent's `onCloseAutoFocus`, so a caller that closes its own popover before opening this dialog can redirect focus back to its trigger. */
  onCloseAutoFocus?: (event: Event) => void;
}

/**
 * Inline tag-creation modal, opened from a row's tag picker or the filter
 * popover — both close their own popover before opening this dialog. Thin
 * adapter over the generalised `TagFormDialog` (#1120) — see that component
 * for the shared form/preset/preview logic.
 */
export default function CreateTagDialog({ open, onOpenChange, onCreated, onCloseAutoFocus }: Props) {
  const { t } = useTranslation();
  const createMutation = useCreateClientTag();

  function handleSubmit(values: TagFormValues) {
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
    <TagFormDialog
      open={open}
      onOpenChange={onOpenChange}
      mode="create"
      isPending={createMutation.isPending}
      onSubmit={handleSubmit}
      onCloseAutoFocus={onCloseAutoFocus}
      labels={{
        title: t('clients.tagPicker.createTitle'),
        description: t('clients.tagPicker.createDescription'),
        nameLabel: t('clients.tagPicker.nameLabel'),
        namePlaceholder: t('clients.tagPicker.namePlaceholder'),
        colorLabel: t('clients.tagPicker.colorLabel'),
        descriptionLabel: t('clients.tagPicker.descriptionLabel'),
        descriptionPlaceholder: t('clients.tagPicker.descriptionPlaceholder'),
        previewLabel: t('clients.tagPicker.previewLabel'),
        previewSampleName: t('clients.tagPicker.previewSampleName'),
        submitLabel: t('clients.tagPicker.createSubmit'),
        savingLabel: t('common.saving'),
        cancelLabel: t('common.cancel'),
        nameRequiredError: t('clients.tagPicker.validation.nameRequired'),
        colorInvalidError: t('clients.tagPicker.validation.colorInvalid'),
        colorPresetLabels: {
          red: t('clients.tagPicker.colors.red'),
          orange: t('clients.tagPicker.colors.orange'),
          yellow: t('clients.tagPicker.colors.yellow'),
          green: t('clients.tagPicker.colors.green'),
          blue: t('clients.tagPicker.colors.blue'),
          purple: t('clients.tagPicker.colors.purple'),
          pink: t('clients.tagPicker.colors.pink'),
          grey: t('clients.tagPicker.colors.grey'),
        },
      }}
    />
  );
}
