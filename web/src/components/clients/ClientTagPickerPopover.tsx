import { useState } from 'react';
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
 */
export default function ClientTagPickerPopover({ client }: Props) {
  const { t } = useTranslation();
  const [createOpen, setCreateOpen] = useState(false);
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

  return (
    <>
      <Popover>
        <PopoverTrigger asChild>
          <Button type="button" variant="ghost" size="icon-xs" aria-label={t('clients.tagPicker.open')}>
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
                        <Checkbox
                          checked={Boolean(tag.tagId) && assignedIds.has(tag.tagId ?? '')}
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
              <Button type="button" variant="outline" size="sm" onClick={() => setCreateOpen(true)}>
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
      />
    </>
  );
}
