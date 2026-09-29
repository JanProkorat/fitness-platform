import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Tag as TagIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import type { ClientSummary } from '@/api/clients';
import { useClientTags, useAssignClientTags } from '@/hooks/useClientsQueries';
import CreateTagDialog from '@/components/clients/CreateTagDialog';

interface Props {
  client: ClientSummary;
}

/**
 * Per-row tag assignment. Built on Popover (not DropdownMenu) for the same
 * reason as `ClientTagFilterPopover` — multi-select without fighting
 * Radix's close-on-select default. Always sends the *full* desired tag set
 * to `replaceClientTagAssignments`, so a stale double-click can't partially
 * apply — see `useAssignClientTags`' own doc comment for why this is not
 * optimistic.
 *
 * The popover is controlled (`open`), same fix as `ClientTagFilterPopover`:
 * opening the modal `CreateTagDialog` steals focus and shows an overlay,
 * which an *uncontrolled* Popover reads as an outside interaction and
 * dismisses on its own — so this popover was already closing the moment the
 * dialog opened, just as an implicit side effect instead of an explicit one.
 * Making it explicit (`handleCreateClick` closes the popover, then opens the
 * dialog) is what lets `onCloseAutoFocus` reliably refocus this row's own
 * trigger button, rather than Radix falling back to `<body>` because the
 * element it would otherwise restore focus to (the popover's own
 * "+ Create tag" button) is already unmounted by the time the dialog closes.
 */
export default function ClientTagPickerPopover({ client }: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const tagsQuery = useClientTags();
  const assignMutation = useAssignClientTags();
  const tags = tagsQuery.data ?? [];
  const assignedIds = new Set(
    (client.tags ?? []).map((tag) => tag.tagId).filter((id): id is string => Boolean(id)),
  );

  function toggleTag(tagId: string) {
    if (!client.publicId) {
      return;
    }
    const next = assignedIds.has(tagId)
      ? [...assignedIds].filter((id) => id !== tagId)
      : [...assignedIds, tagId];
    assignMutation.mutate({ clientPublicId: client.publicId, tagIds: next });
  }

  function handleCreateClick() {
    setOpen(false);
    setCreateOpen(true);
  }

  function handleCreateDialogCloseAutoFocus(event: Event) {
    event.preventDefault();
    triggerRef.current?.focus();
  }

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button ref={triggerRef} type="button" variant="ghost" size="icon-xs" aria-label={t('clients.tagPicker.open')}>
            <TagIcon className="size-3.5" aria-hidden="true" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-64">
          {tagsQuery.isPending ? (
            <p className="text-body text-muted-foreground">{t('common.loading')}</p>
          ) : (
            <div className="flex flex-col gap-3">
              {tags.length === 0 ? (
                <p className="text-body text-muted-foreground">{t('clients.tagFilter.empty')}</p>
              ) : (
                <ul className="flex flex-col gap-2.5">
                  {tags.map((tag) => (
                    <li key={tag.tagId}>
                      <label className="flex cursor-pointer items-center gap-2 text-body text-foreground">
                        {/*
                          Disabled while a write is in flight because the
                          endpoint replaces the whole set and `assignedIds`
                          derives from the row, which only refreshes when the
                          response lands. Ticking a second tag before the first
                          returns would compute its set from stale data and
                          silently drop the first one.
                        */}
                        <Checkbox
                          checked={Boolean(tag.tagId) && assignedIds.has(tag.tagId ?? '')}
                          disabled={assignMutation.isPending}
                          onCheckedChange={() => tag.tagId && toggleTag(tag.tagId)}
                        />
                        <span
                          className={cn('size-2.5 shrink-0 rounded-full', !tag.colorHex && 'bg-muted-foreground')}
                          style={tag.colorHex ? { backgroundColor: tag.colorHex } : undefined}
                          aria-hidden="true"
                        />
                        {tag.name}
                      </label>
                    </li>
                  ))}
                </ul>
              )}
              <Button type="button" variant="outline" size="sm" onClick={handleCreateClick}>
                <Plus className="size-3.5" aria-hidden="true" />
                {t('clients.tagPicker.createTag')}
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>
      <CreateTagDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(tag) => {
          if (client.publicId && tag.tagId) {
            assignMutation.mutate({ clientPublicId: client.publicId, tagIds: [...assignedIds, tag.tagId] });
          }
        }}
        onCloseAutoFocus={handleCreateDialogCloseAutoFocus}
      />
    </>
  );
}
