import { useState } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Users } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { AutomationAudience, type AutomationRuleDto } from '@/api/automations';
import { getClients } from '@/api/clients';
import { useClientTags } from '@/hooks/useClientsQueries';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import {
  FIELD_CLASS,
  FieldError,
  SELECT_CLASS,
  SectionHeading,
  SelectChevron,
} from '@/components/automations/automationFormParts';
import type { AutomationRuleFormValues } from '@/components/automations/automationRuleForm';

const PICKER_PAGE_SIZE = 50;

interface Props {
  /** Clients already chosen on the saved rule, so their names show before the picker list loads. */
  initialClients?: AutomationRuleDto['clients'];
}

function useClientPicker(search: string) {
  return useQuery({
    queryKey: ['clients', 'automationPicker', search],
    queryFn: () => getClients({ page: 1, pageSize: PICKER_PAGE_SIZE, tagIds: [], search: search || undefined }),
  });
}

/** Section 3: all clients, clients with a tag, or chosen clients. */
export default function AutomationWhoSection({ initialClients = [] }: Props) {
  const { t } = useTranslation();
  const { register, setValue, control } = useFormContext<AutomationRuleFormValues>();
  const audience = useWatch({ control, name: 'audience' });
  const chosenIds = useWatch({ control, name: 'audienceClientIds' });
  const tagsQuery = useClientTags();
  const [searchInput, setSearchInput] = useState('');
  const search = useDebouncedValue(searchInput, 300);
  const pickerQuery = useClientPicker(search);
  const clients = pickerQuery.data?.clients ?? [];

  // Names of chosen clients, so they stay readable after the search list moves on.
  const [names, setNames] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      initialClients.flatMap((c) => (c.clientId ? [[c.clientId, `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim()]] : [])),
    ),
  );
  const nameOf = (id: string): string => names[id] ?? id;

  const toggleClient = (id: string, label: string, checked: boolean) => {
    if (checked) {
      setNames((current) => ({ ...current, [id]: label }));
    }
    const next = checked ? [...chosenIds, id] : chosenIds.filter((existing) => existing !== id);
    setValue('audienceClientIds', next, { shouldDirty: true, shouldValidate: true });
  };

  return (
    <section className="flex flex-col gap-3">
      <SectionHeading icon={<Users className="size-4" />}>{t('automations.drawer.who.heading')}</SectionHeading>
      <label className={FIELD_CLASS}>
        <span>{t('automations.drawer.who.clients')}</span>
        <div className="relative">
          <select {...register('audience')} className={SELECT_CLASS}>
            <option value={AutomationAudience.All}>{t('automations.drawer.who.all')}</option>
            <option value={AutomationAudience.Tag}>{t('automations.drawer.who.tag')}</option>
            <option value={AutomationAudience.Chosen}>{t('automations.drawer.who.chosen')}</option>
          </select>
          <SelectChevron />
        </div>
        {audience === AutomationAudience.All && (
          <span className="text-meta text-muted-foreground">{t('automations.drawer.who.allHint')}</span>
        )}
      </label>

      {audience === AutomationAudience.Tag && (
        <label className={FIELD_CLASS}>
          <span>{t('automations.drawer.who.tagLabel')}</span>
          <div className="relative">
            <select {...register('audienceTagId')} className={SELECT_CLASS}>
              <option value="">{t('automations.drawer.who.tagPlaceholder')}</option>
              {(tagsQuery.data ?? []).map((tag) => (
                <option key={tag.tagId} value={tag.tagId}>
                  {tag.name}
                </option>
              ))}
            </select>
            <SelectChevron />
          </div>
          <FieldError name="audienceTagId" />
        </label>
      )}

      {audience === AutomationAudience.Chosen && (
        <div className={FIELD_CLASS}>
          <span>{t('automations.drawer.who.chooseClients')}</span>
          <Input
            type="search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder={t('automations.drawer.who.searchClients')}
            aria-label={t('automations.drawer.who.searchClients')}
          />
          <ul className="flex max-h-48 flex-col overflow-y-auto rounded-field border border-line">
            {pickerQuery.isError && (
              <li className="px-3 py-2 text-meta font-normal text-destructive">
                {t('automations.drawer.who.clientsError')}
              </li>
            )}
            {!pickerQuery.isPending && !pickerQuery.isError && clients.length === 0 && (
              <li className="px-3 py-2 text-meta font-normal text-muted-foreground">
                {t('automations.drawer.who.noClients')}
              </li>
            )}
            {clients.map((client) => {
              const id = client.publicId ?? '';
              const label = `${client.firstName ?? ''} ${client.lastName ?? ''}`.trim();
              return (
                <li key={id} className="border-b border-line last:border-b-0">
                  <label className="flex cursor-pointer items-center gap-2.5 px-3 py-2 text-body font-normal text-ink">
                    <Checkbox checked={chosenIds.includes(id)} onCheckedChange={(checked) => toggleClient(id, label, checked === true)} />
                    {label}
                  </label>
                </li>
              );
            })}
          </ul>
          {chosenIds.length > 0 && (
            <p className="text-meta font-normal text-muted-foreground">
              {t('automations.drawer.who.selected', { count: chosenIds.length, names: chosenIds.map(nameOf).join(', ') })}
            </p>
          )}
          <FieldError name="audienceClientIds" />
        </div>
      )}
    </section>
  );
}
