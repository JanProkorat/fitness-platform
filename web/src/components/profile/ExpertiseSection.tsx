import { Controller, useFormContext } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Award, GripVertical, Plus, X } from 'lucide-react';
import { DragDropProvider } from '@dnd-kit/react';
import { useSortable } from '@dnd-kit/react/sortable';
import { move } from '@dnd-kit/helpers';
import { Input } from '@/components/ui/input';
import { TagInput } from '@/components/ui/tag-input';
import { Field, ProfileSection } from '@/components/profile/ProfileSection';
import {
  emptyCertificate,
  type CertificateItem,
  type ProfileFormValues,
} from '@/components/profile/profile-form';

interface CertificateRowProps {
  item: CertificateItem;
  index: number;
  titleError: string | undefined;
  onChange: (id: string, patch: Partial<CertificateItem>) => void;
  onRemove: (id: string) => void;
}

/** One draggable certificate. Declared at module scope so its sortable state survives parent re-renders. */
function CertificateRow({ item, index, titleError, onChange, onRemove }: CertificateRowProps) {
  const { t } = useTranslation();
  const { ref, handleRef, isDragging } = useSortable({ id: item.id, index });
  const position = index + 1;

  return (
    <li
      ref={ref}
      className={`flex items-start gap-2.5 border-b border-border py-3 ${isDragging ? 'opacity-60' : ''}`}
    >
      <button
        type="button"
        ref={handleRef}
        className="mt-2 cursor-grab text-faint hover:text-muted-foreground"
        aria-label={t('profile.page.expertise.reorderCertificate', { number: position })}
      >
        <GripVertical className="size-4" aria-hidden="true" />
      </button>
      <span className="mt-0.5 hidden size-9 shrink-0 items-center justify-center rounded-md border border-border bg-surface text-nutrition sm:flex">
        <Award className="size-4" aria-hidden="true" />
      </span>
      <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-[minmax(0,2fr)_minmax(0,1.5fr)_5rem]">
        <div className="flex min-w-0 flex-col gap-1">
          <Input
            value={item.title}
            onChange={(event) => onChange(item.id, { title: event.target.value })}
            placeholder={t('profile.page.expertise.certificateTitle')}
            aria-label={t('profile.page.expertise.certificateTitleLabel', { number: position })}
            aria-invalid={!!titleError}
            aria-describedby={titleError ? `profile-certificate-${item.id}-title-error` : undefined}
            className="h-9"
          />
          {titleError && (
            <p id={`profile-certificate-${item.id}-title-error`} role="alert" className="text-meta text-error">
              {titleError}
            </p>
          )}
        </div>
        <Input
          value={item.issuer}
          onChange={(event) => onChange(item.id, { issuer: event.target.value })}
          placeholder={t('profile.page.expertise.certificateIssuer')}
          aria-label={t('profile.page.expertise.certificateIssuerLabel', { number: position })}
          className="h-9"
        />
        <Input
          value={item.year}
          inputMode="numeric"
          maxLength={4}
          onChange={(event) => onChange(item.id, { year: event.target.value.replace(/\D/g, '') })}
          placeholder={t('profile.page.expertise.certificateYear')}
          aria-label={t('profile.page.expertise.certificateYearLabel', { number: position })}
          className="h-9"
        />
      </div>
      <button
        type="button"
        className="mt-2 cursor-pointer text-muted-foreground hover:text-foreground"
        aria-label={t('profile.page.expertise.removeCertificate', { number: position })}
        onClick={() => onRemove(item.id)}
      >
        <X className="size-4" aria-hidden="true" />
      </button>
    </li>
  );
}

export default function ExpertiseSection() {
  const { t } = useTranslation();
  const {
    control,
    formState: { errors },
  } = useFormContext<ProfileFormValues>();

  return (
    <ProfileSection title={t('profile.page.expertise.title')} description={t('profile.page.expertise.description')}>
      <Controller
        control={control}
        name="specializations"
        render={({ field }) => (
          <Field
            label={t('profile.specializations')}
            htmlFor="profile-specializations"
            hint={t('profile.page.expertise.specializationsHint')}
            error={errors.specializations?.message}
          >
            <TagInput
              id="profile-specializations"
              value={field.value}
              onChange={field.onChange}
              placeholder={t('profile.addSpecialization')}
              removeLabel={(tag) => t('common.removeChip', { value: tag })}
              invalid={!!errors.specializations}
              aria-describedby="profile-specializations-message"
            />
          </Field>
        )}
      />

      <Controller
        control={control}
        name="languages"
        render={({ field }) => (
          <Field
            label={t('profile.languages')}
            htmlFor="profile-languages"
            hint={t('profile.page.expertise.languagesHint')}
            error={errors.languages?.message}
          >
            <TagInput
              id="profile-languages"
              value={field.value}
              onChange={field.onChange}
              placeholder={t('profile.addLanguage')}
              removeLabel={(tag) => t('common.removeChip', { value: tag })}
              invalid={!!errors.languages}
              aria-describedby="profile-languages-message"
            />
          </Field>
        )}
      />

      <Controller
        control={control}
        name="certificates"
        render={({ field }) => {
          const items = field.value;
          const update = (id: string, patch: Partial<CertificateItem>) =>
            field.onChange(items.map((item) => (item.id === id ? { ...item, ...patch } : item)));
          const error = errors.certificates?.message ?? errors.certificates?.root?.message;
          return (
            <div className="flex flex-col gap-2">
              <span className="text-meta font-medium text-ink-2" id="profile-certificates-label">
                {t('profile.page.expertise.certificates')}
              </span>
              <DragDropProvider
                onDragEnd={(event) => {
                  if (event.canceled) return;
                  field.onChange(move(items, event));
                }}
              >
                <ul aria-labelledby="profile-certificates-label" className="flex flex-col border-t border-border">
                  {items.map((item, index) => (
                    <CertificateRow
                      key={item.id}
                      item={item}
                      index={index}
                      titleError={errors.certificates?.[index]?.title?.message}
                      onChange={update}
                      onRemove={(id) => field.onChange(items.filter((entry) => entry.id !== id))}
                    />
                  ))}
                </ul>
              </DragDropProvider>
              {error && (
                <p role="alert" className="text-meta text-error">
                  {error}
                </p>
              )}
              <button
                type="button"
                className="inline-flex h-9 w-fit cursor-pointer items-center gap-1.5 rounded-field border border-border bg-background px-3 text-body font-semibold text-ink hover:bg-muted"
                onClick={() => field.onChange([...items, emptyCertificate()])}
              >
                <Plus className="size-4" aria-hidden="true" />
                {t('profile.page.expertise.addCertificate')}
              </button>
            </div>
          );
        }}
      />
    </ProfileSection>
  );
}
