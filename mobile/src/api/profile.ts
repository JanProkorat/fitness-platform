import api from './client'

// --- Types ---

export interface ComplianceScoreResponse {
  compliancePercent: number
  mealsPlanned: number
  mealsLogged: number
  currentStreak: number
  from: string
  to: string
}

export interface UpdateProfileRequest {
  firstName: string
  lastName: string
  phoneNumber?: string | null
}

// --- API calls ---

export async function getComplianceScore(params?: {
  from?: string
  to?: string
}): Promise<ComplianceScoreResponse> {
  const { data } = await api.get<ComplianceScoreResponse>(
    '/client/progress/compliance',
    { params },
  )
  return data
}

export async function updateProfile(body: UpdateProfileRequest): Promise<void> {
  await api.put('/users/me', body)
}
