import api from '@/lib/api';

interface AddRoleResponse {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  addedRole: string;
}

export async function addRole(role: string): Promise<AddRoleResponse> {
  const { data } = await api.post<AddRoleResponse>('/users/me/roles', { role });
  return data;
}
