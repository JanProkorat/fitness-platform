import api from './client';

export async function resendVerification(): Promise<{ remainingResends: number }> {
  const { data } = await api.post('/auth/resend-verification');
  return data;
}
