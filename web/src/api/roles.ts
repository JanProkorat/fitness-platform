import api from '@/lib/api';
import { apiClient } from '@/api/client';
import type { CoachRoleSummaryDto } from '@/api/generated';

interface AddRoleResponse {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  addedRole: string;
}

/** POST /users/me/roles — also restores a removed role; returns a fresh token pair either way. */
export async function addRole(role: string): Promise<AddRoleResponse> {
  const { data } = await api.post<AddRoleResponse>('/users/me/roles', { role });
  return data;
}

/** Client counts for one active coach role, with the optional fields resolved. */
export interface CoachRoleSummary {
  role: string;
  clientCount: number;
  sharedWithOtherRoleCount: number;
}

function toSummary(dto: CoachRoleSummaryDto): CoachRoleSummary | null {
  if (!dto.role) return null;
  return {
    role: dto.role,
    clientCount: dto.clientCount ?? 0,
    sharedWithOtherRoleCount: dto.sharedWithOtherRoleCount ?? 0,
  };
}

function toSummaries(dtos: CoachRoleSummaryDto[] | undefined): CoachRoleSummary[] {
  return (dtos ?? []).flatMap((dto) => toSummary(dto) ?? []);
}

/** GET /users/me/roles — the caller's ACTIVE coach roles with client counts. */
export async function getMyCoachRoles(): Promise<CoachRoleSummary[]> {
  const result = await apiClient.getMyCoachRolesEndpoint();
  return toSummaries(result.roles);
}

/**
 * DELETE /users/me/roles/{role} — 400 ROLE_NOT_ASSIGNED / ONLY_COACH_ROLE.
 * The JWT keeps the Identity role, so no token change follows.
 */
export async function removeCoachRole(role: string): Promise<{ removedRole: string }> {
  const result = await apiClient.removeCoachRoleEndpoint(role);
  return { removedRole: result.removedRole ?? role };
}

export const rolesKeys = {
  mine: ['roles', 'me'] as const,
};
