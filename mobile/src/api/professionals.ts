import { api } from '@/api/client';
import type { GetPublicProfileResponse, ProfessionalSummaryDto } from '@/api/generated';
import { ROLE_NUTRITIONIST, ROLE_TRAINER } from '@/api/profile';

export type CoachSummary = ProfessionalSummaryDto;
export type CoachProfile = GetPublicProfileResponse;
export type CoachRole = typeof ROLE_TRAINER | typeof ROLE_NUTRITIONIST;

export type CoachSearchFilters = {
  /** `undefined` searches every role. */
  role: CoachRole | undefined;
  /** Name search; empty means none. */
  search: string;
  /** Sent to the backend exactly as listed on a result. */
  specialization: string | undefined;
  online: boolean;
};

export type CoachSearchPage = {
  items: CoachSummary[];
  totalCount: number;
  page: number;
};

export const SEARCH_PAGE_SIZE = 20;

export const COACH_QUERY_KEY = ['professionals'] as const;

export const coachProfileQueryKey = (publicId: string) =>
  [...COACH_QUERY_KEY, 'profile', publicId] as const;

/** One page of GET /professionals/search. */
export async function fetchCoachPage(
  filters: CoachSearchFilters,
  page: number,
  signal?: AbortSignal,
): Promise<CoachSearchPage> {
  const search = filters.search.trim();
  const response = await api.searchProfessionalsEndpoint(
    page,
    SEARCH_PAGE_SIZE,
    undefined,
    filters.specialization,
    filters.role,
    search.length > 0 ? search : undefined,
    filters.online ? true : undefined,
    signal,
  );
  return {
    items: response.items ?? [],
    totalCount: response.totalCount ?? 0,
    page: response.page ?? page,
  };
}

/** GET /professionals/{publicId}. */
export function fetchCoachProfile(publicId: string, signal?: AbortSignal): Promise<CoachProfile> {
  return api.getPublicProfileEndpoint(publicId, signal);
}

/** The role the row and profile are labelled with; a coach with both roles shows the first one listed. */
export function primaryRole(roles: readonly string[] | undefined): CoachRole | undefined {
  return (roles ?? []).find(
    (role): role is CoachRole => role === ROLE_TRAINER || role === ROLE_NUTRITIONIST,
  );
}

const COACH_ROLES: readonly CoachRole[] = [ROLE_TRAINER, ROLE_NUTRITIONIST];

/** Every coach role the coach holds, trainer first, without duplicates. */
export function coachRoles(roles: readonly string[] | undefined): CoachRole[] {
  const held = roles ?? [];
  return COACH_ROLES.filter((role) => held.includes(role));
}

export function coachFullName(coach: { firstName?: string; lastName?: string }): string {
  return [coach.firstName, coach.lastName].filter(Boolean).join(' ');
}

export function coachInitials(coach: { firstName?: string; lastName?: string }): string {
  const first = coach.firstName?.trim().charAt(0) ?? '';
  const last = coach.lastName?.trim().charAt(0) ?? '';
  return `${first}${last}`.toUpperCase();
}

const CHIP_LIMIT = 6;

/** The most frequent specializations of the given results, most frequent first. */
export function topSpecializations(coaches: readonly CoachSummary[]): string[] {
  const counts = new Map<string, number>();
  for (const coach of coaches) {
    for (const raw of new Set(coach.specializations ?? [])) {
      const value = raw.trim();
      if (value.length > 0) counts.set(value, (counts.get(value) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, CHIP_LIMIT)
    .map(([value]) => value);
}
