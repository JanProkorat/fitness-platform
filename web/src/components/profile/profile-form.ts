import { z } from 'zod';
import type { TFunction } from 'i18next';
import type { GetProfessionalProfileResponse, GetProfileResponse } from '@/api/generated';
import type { UpdateTrainerProfilePayload } from '@/api/profile';

export const BIO_MAX = 1000;
const NAME_MAX = 50;
const PHONE_MAX = 30;
const SHORT_MAX = 100;
const LINK_MAX = 200;
const SPECIALIZATIONS_JSON_MAX = 2000;
const LANGUAGES_JSON_MAX = 1000;
const CERTIFICATES_JSON_MAX = 2000;

export type CollaborationType = 'online' | 'inperson' | 'both';

export interface CertificateItem {
  /** Client-only key for list rendering and drag-reorder; never sent to the API. */
  id: string;
  title: string;
  issuer: string;
  year: string;
}

export interface ProfileFormValues {
  firstName: string;
  lastName: string;
  phoneNumber: string;
  timeZone: string;
  bio: string;
  city: string;
  estimatedPrice: string;
  specializations: string[];
  languages: string[];
  certificates: CertificateItem[];
  collaborationType: CollaborationType;
  website: string;
  instagram: string;
  linkedIn: string;
  showInSearch: boolean;
  acceptNewClients: boolean;
}

export function initialsOf(firstName: string, lastName: string): string {
  return `${firstName.trim()[0] ?? ''}${lastName.trim()[0] ?? ''}`.toUpperCase() || '?';
}

export function newCertificateId(): string {
  return crypto.randomUUID();
}

export function emptyCertificate(): CertificateItem {
  return { id: newCertificateId(), title: '', issuer: '', year: '' };
}

function parseJson(raw: string | undefined | null): unknown {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

/** Tolerant read of a JSON string array; falls back to comma-separated text for legacy rows. */
export function parseStringList(raw: string | undefined | null): string[] {
  if (!raw) return [];
  const parsed = parseJson(raw);
  if (Array.isArray(parsed)) {
    return parsed
      .filter((entry): entry is string => typeof entry === 'string')
      .map((entry) => entry.trim())
      .filter(Boolean);
  }
  if (parsed === null && !raw.trimStart().startsWith('[')) {
    return raw
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean);
  }
  return [];
}

function asText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  return '';
}

/** Reads certificates: legacy string entries become {title}, objects keep issuer and year. */
export function parseCertificates(raw: string | undefined | null): CertificateItem[] {
  const parsed = parseJson(raw);
  if (!Array.isArray(parsed)) return [];
  const items: CertificateItem[] = [];
  for (const entry of parsed) {
    if (typeof entry === 'string') {
      if (entry.trim()) items.push({ id: newCertificateId(), title: entry.trim(), issuer: '', year: '' });
    } else if (typeof entry === 'object' && entry !== null) {
      const record = entry as Record<string, unknown>;
      const title = asText(record.title).trim();
      if (title) {
        items.push({
          id: newCertificateId(),
          title,
          issuer: asText(record.issuer).trim(),
          year: asText(record.year).trim(),
        });
      }
    }
  }
  return items;
}

export function serializeCertificates(items: CertificateItem[]): string {
  return JSON.stringify(
    items
      .filter((item) => item.title.trim() !== '')
      .map((item) => ({ title: item.title.trim(), issuer: item.issuer.trim(), year: item.year.trim() })),
  );
}

function toCollaborationType(value: string | undefined | null): CollaborationType {
  return value === 'online' || value === 'inperson' || value === 'both' ? value : 'both';
}

export function buildDefaultValues(
  me: GetProfileResponse,
  trainer: GetProfessionalProfileResponse,
): ProfileFormValues {
  return {
    firstName: me.firstName ?? '',
    lastName: me.lastName ?? '',
    phoneNumber: me.phoneNumber ?? '',
    timeZone: me.timeZone ?? '',
    bio: trainer.bio ?? '',
    city: trainer.city ?? '',
    estimatedPrice: trainer.estimatedPrice ?? '',
    specializations: parseStringList(trainer.specializations),
    languages: parseStringList(trainer.languages),
    certificates: parseCertificates(trainer.certificates),
    collaborationType: toCollaborationType(trainer.collaborationType),
    website: trainer.website ?? '',
    instagram: trainer.instagram ?? '',
    linkedIn: trainer.linkedIn ?? '',
    showInSearch: trainer.showInSearch ?? true,
    acceptNewClients: trainer.acceptNewClients ?? true,
  };
}

function orNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

/** PUT /trainer/profile is a full replace — every field is sent, the legacy `specialization` untouched. */
export function buildTrainerPayload(
  values: ProfileFormValues,
  legacySpecialization: string | undefined,
): UpdateTrainerProfilePayload {
  return {
    bio: orNull(values.bio),
    specialization: legacySpecialization ?? null,
    city: orNull(values.city),
    estimatedPrice: orNull(values.estimatedPrice),
    specializations: JSON.stringify(values.specializations),
    certificates: serializeCertificates(values.certificates),
    languages: JSON.stringify(values.languages),
    collaborationType: values.collaborationType,
    linkedIn: orNull(values.linkedIn),
    instagram: orNull(values.instagram),
    website: orNull(values.website),
    showInSearch: values.showInSearch,
    acceptNewClients: values.acceptNewClients,
  };
}

export function createProfileSchema(t: TFunction) {
  const required = t('profile.page.validation.required');
  return z.object({
    firstName: z.string().trim().min(1, required).max(NAME_MAX, t('profile.page.validation.tooLong', { max: NAME_MAX })),
    lastName: z.string().trim().min(1, required).max(NAME_MAX, t('profile.page.validation.tooLong', { max: NAME_MAX })),
    phoneNumber: z.string().max(PHONE_MAX, t('profile.page.validation.tooLong', { max: PHONE_MAX })),
    timeZone: z.string(),
    bio: z.string().max(BIO_MAX, t('profile.page.validation.tooLong', { max: BIO_MAX })),
    city: z.string().max(SHORT_MAX, t('profile.page.validation.tooLong', { max: SHORT_MAX })),
    estimatedPrice: z.string().max(SHORT_MAX, t('profile.page.validation.tooLong', { max: SHORT_MAX })),
    specializations: z
      .array(z.string())
      .refine((list) => JSON.stringify(list).length <= SPECIALIZATIONS_JSON_MAX, t('profile.page.validation.listTooLong')),
    languages: z
      .array(z.string())
      .refine((list) => JSON.stringify(list).length <= LANGUAGES_JSON_MAX, t('profile.page.validation.listTooLong')),
    certificates: z
      .array(
        z.object({
          id: z.string(),
          title: z.string(),
          issuer: z.string(),
          year: z.string().max(4, t('profile.page.validation.year')),
        }),
      )
      .refine((list) => serializeCertificates(list).length <= CERTIFICATES_JSON_MAX, t('profile.page.validation.listTooLong'))
      .superRefine((list, ctx) => {
        // Fully empty rows are dropped on save; a row with only an issuer or year needs a title.
        list.forEach((item, index) => {
          if (item.title.trim() === '' && (item.issuer.trim() !== '' || item.year.trim() !== '')) {
            ctx.addIssue({
              code: 'custom',
              message: t('profile.page.validation.certificateTitleRequired'),
              path: [index, 'title'],
            });
          }
        });
      }),
    collaborationType: z.enum(['online', 'inperson', 'both']),
    website: z.string().max(LINK_MAX, t('profile.page.validation.tooLong', { max: LINK_MAX })),
    instagram: z.string().max(LINK_MAX, t('profile.page.validation.tooLong', { max: LINK_MAX })),
    linkedIn: z.string().max(LINK_MAX, t('profile.page.validation.tooLong', { max: LINK_MAX })),
    showInSearch: z.boolean(),
    acceptNewClients: z.boolean(),
  });
}

/** Form field names a backend validator error (`errors[].name`) can be mapped onto. */
const FIELD_BY_BACKEND_NAME: Record<string, keyof ProfileFormValues> = {
  firstname: 'firstName',
  lastname: 'lastName',
  phonenumber: 'phoneNumber',
  timezone: 'timeZone',
  bio: 'bio',
  city: 'city',
  estimatedprice: 'estimatedPrice',
  specializations: 'specializations',
  languages: 'languages',
  certificates: 'certificates',
  collaborationtype: 'collaborationType',
  website: 'website',
  instagram: 'instagram',
  linkedin: 'linkedIn',
};

export function fieldForBackendName(name: string | undefined): keyof ProfileFormValues | null {
  if (!name) return null;
  return FIELD_BY_BACKEND_NAME[name.replace(/[^a-z]/gi, '').toLowerCase()] ?? null;
}
