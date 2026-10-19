import { expect, request as apiRequest } from '@playwright/test';

/**
 * The seed creates no weekly check-in setting, and the linked check-in row only exists once the coach has one.
 * PUT upserts the QA trainer's Training setting, so running it again (or in parallel) changes nothing.
 */
export async function ensureCheckInSetting(baseURL: string) {
  const password = process.env['QA_SEED_PASSWORD'];
  if (!password) {
    throw new Error('QA_SEED_PASSWORD is not set. Copy .env.test.example to .env.test and fill it in.');
  }
  const api = await apiRequest.newContext({ baseURL });
  try {
    const login = await api.post('/auth/login', {
      data: { email: 'qa.trainer@fitnessplatform.test', password },
    });
    expect(login.ok()).toBe(true);
    const { accessToken } = (await login.json()) as { accessToken: string };
    const put = await api.put('/trainer/weekly-check-ins/settings', {
      headers: { Authorization: `Bearer ${accessToken}` },
      data: { profession: 'Training', dayOfWeek: 1, timeOfDay: '09:00:00', enabled: true, deadlineOffsetHours: 72 },
    });
    expect(put.ok()).toBe(true);
  } finally {
    await api.dispose();
  }
}
