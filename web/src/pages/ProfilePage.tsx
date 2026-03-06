import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/auth';
import api from '@/lib/api';

export default function ProfilePage() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const profileSchema = z.object({
    firstName: z.string().min(1, t('validation.required')),
    lastName: z.string().min(1, t('validation.required')),
    bio: z.string().optional(),
  });

  type ProfileForm = z.infer<typeof profileSchema>;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
  });

  useEffect(() => {
    if (user) {
      reset({
        firstName: user.firstName,
        lastName: user.lastName,
      });
    }
  }, [user, reset]);

  const onSubmit = async (data: ProfileForm) => {
    setStatus(null);
    setLoading(true);
    try {
      const res = await api.put('/users/me', data);
      setUser({
        ...user!,
        firstName: res.data.firstName,
        lastName: res.data.lastName,
      });
      setStatus(t('profile.saved'));
    } catch {
      setStatus(t('profile.saveError'));
    } finally {
      setLoading(false);
    }
  };

  const initials = user
    ? `${user.firstName[0]}${user.lastName[0]}`.toUpperCase()
    : '??';

  return (
    <div className="flex h-full flex-col">
      {/* Top bar */}
      <div className="border-b border-border bg-[#111111] px-6 py-4">
        <h1 className="text-lg font-bold">{t('profile.title')}</h1>
        <p className="text-xs text-muted">{t('profile.subtitle')}</p>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-[560px]">
          {/* Avatar + info */}
          <div className="mb-6 flex items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-sm border-2 border-gold/30 bg-gold/10 font-heading text-xl font-bold text-gold">
              {initials}
            </div>
            <div>
              <div className="text-base font-semibold">
                {user?.firstName} {user?.lastName}
              </div>
              <div className="text-sm text-text2">{user?.email}</div>
              <div className="mt-1 text-xs text-muted">
                {user?.roles.join(', ')}
              </div>
            </div>
          </div>

          {/* Form */}
          <form
            onSubmit={handleSubmit(onSubmit)}
            className="rounded-sm border border-border bg-surface p-6"
          >
            <div className="mb-5">
              <label className="lbl mb-2 block">{t('profile.firstName')}</label>
              <input
                {...register('firstName')}
                className="w-full rounded-sm border border-border bg-bg px-4 py-3 text-sm text-text outline-none transition-colors focus:border-gold/40"
              />
              {errors.firstName && (
                <p className="mt-1 text-xs text-red">
                  {errors.firstName.message}
                </p>
              )}
            </div>

            <div className="mb-5">
              <label className="lbl mb-2 block">{t('profile.lastName')}</label>
              <input
                {...register('lastName')}
                className="w-full rounded-sm border border-border bg-bg px-4 py-3 text-sm text-text outline-none transition-colors focus:border-gold/40"
              />
              {errors.lastName && (
                <p className="mt-1 text-xs text-red">
                  {errors.lastName.message}
                </p>
              )}
            </div>

            <div className="mb-6">
              <label className="lbl mb-2 block">{t('profile.bio')}</label>
              <textarea
                {...register('bio')}
                rows={3}
                className="w-full resize-none rounded-sm border border-border bg-bg px-4 py-3 text-sm text-text outline-none transition-colors focus:border-gold/40"
                placeholder={t('profile.bioPlaceholder')}
              />
            </div>

            {status && (
              <div
                className={`mb-4 rounded-sm border px-4 py-2.5 text-sm ${
                  status === t('profile.saveError')
                    ? 'border-red-dim bg-red/8 text-red'
                    : 'border-green-bright/30 bg-green-bright/8 text-green-bright'
                }`}
              >
                {status}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="rounded-sm bg-gold px-6 py-3 font-heading text-[13px] font-extrabold uppercase tracking-[1.5px] text-black transition-colors hover:bg-gold-bright disabled:opacity-50"
            >
              {loading ? t('common.saving') : t('common.save')}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
