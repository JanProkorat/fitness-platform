import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/auth';
import { apiClient } from '@/api/client';
import api from '@/lib/api';
import { addRole } from '@/api/roles';

type Tab = 'personal' | 'trainer';

export default function ProfilePage() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const isTrainer = user?.roles.some((r) => ['Trainer', 'Nutritionist'].includes(r));
  const [activeTab, setActiveTab] = useState<Tab>('personal');

  return (
    <div className="flex h-full flex-col">
      {/* Top bar */}
      <div className="border-b border-border bg-bg2 px-6 py-4">
        <h1 className="text-lg font-bold">{t('profile.title')}</h1>
        <p className="text-xs text-text3">{t('profile.subtitle')}</p>
      </div>

      {/* Tabs */}
      {isTrainer && (
        <div className="flex border-b border-border bg-bg2 px-6">
          {(['personal', 'trainer'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors ${
                activeTab === tab
                  ? 'border-accent text-accent'
                  : 'border-transparent text-text3 hover:text-text2'
              }`}
            >
              {t(tab === 'personal' ? 'profile.tabPersonal' : 'profile.tabTrainer')}
            </button>
          ))}
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-[560px]">
          {/* Avatar + info */}
          <div className="mb-6 flex items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-sm border-2 border-accent-br bg-accent-bg text-xl font-bold text-accent">
              {user ? `${user.firstName[0]}${user.lastName[0]}`.toUpperCase() : '??'}
            </div>
            <div>
              <div className="text-base font-semibold">
                {user?.firstName} {user?.lastName}
              </div>
              <div className="text-sm text-text2">{user?.email}</div>
              <div className="mt-1 text-xs text-text3">
                {user?.roles.map((r) => t(`auth.role${r}`)).join(', ')}
              </div>
            </div>
          </div>

          {/* Roles section */}
          {isTrainer && user && <RolesSection user={user} setUser={setUser} />}

          {activeTab === 'personal' && (
            <PersonalForm user={user} setUser={setUser} />
          )}
          {activeTab === 'trainer' && isTrainer && <TrainerForm />}
        </div>
      </div>
    </div>
  );
}

function PersonalForm({
  user,
  setUser,
}: {
  user: ReturnType<typeof useAuthStore.getState>['user'];
  setUser: (u: NonNullable<typeof user>) => void;
}) {
  const { t } = useTranslation();
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const schema = z.object({
    firstName: z.string().min(1, t('validation.required')),
    lastName: z.string().min(1, t('validation.required')),
  });

  type Form = z.infer<typeof schema>;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<Form>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (user) {
      reset({ firstName: user.firstName, lastName: user.lastName });
    }
  }, [user, reset]);

  const onSubmit = async (data: Form) => {
    setStatus(null);
    setLoading(true);
    try {
      await apiClient.updateProfileEndpoint(data);
      setUser({ ...user!, firstName: data.firstName, lastName: data.lastName });
      setStatus(t('profile.saved'));
    } catch {
      setStatus(t('profile.saveError'));
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    'w-full rounded-sm border border-border bg-bg px-4 py-3 text-sm text-text outline-none transition-colors focus:border-border-hv';

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="rounded-sm border border-border bg-bg2 p-6"
    >
      <div className="mb-5">
        <label className="lbl mb-2 block">{t('profile.firstName')}</label>
        <input {...register('firstName')} className={inputClass} />
        {errors.firstName && (
          <p className="mt-1 text-xs text-red">{errors.firstName.message}</p>
        )}
      </div>

      <div className="mb-6">
        <label className="lbl mb-2 block">{t('profile.lastName')}</label>
        <input {...register('lastName')} className={inputClass} />
        {errors.lastName && (
          <p className="mt-1 text-xs text-red">{errors.lastName.message}</p>
        )}
      </div>

      <StatusMessage status={status} errorKey={t('profile.saveError')} />

      <button
        type="submit"
        disabled={loading}
        className="rounded-md bg-text px-6 py-3 text-[13px] font-medium text-bg transition-colors hover:opacity-90 disabled:opacity-50"
      >
        {loading ? t('common.saving') : t('common.save')}
      </button>
    </form>
  );
}

function TrainerForm() {
  const { t } = useTranslation();
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  const schema = z.object({
    bio: z.string().max(1000).optional().or(z.literal('')),
    specialization: z.string().max(100).optional().or(z.literal('')),
    yearsOfExperience: z.coerce.number().int().min(0).max(80),
  });

  type Form = z.infer<typeof schema>;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { bio: '', specialization: '', yearsOfExperience: 0 },
  });

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get('/trainer/profile');
        reset({
          bio: data.bio ?? '',
          specialization: data.specialization ?? '',
          yearsOfExperience: data.yearsOfExperience ?? 0,
        });
      } catch {
        // Profile might not exist yet
      } finally {
        setFetching(false);
      }
    })();
  }, [reset]);

  const onSubmit = async (data: Form) => {
    setStatus(null);
    setLoading(true);
    try {
      await api.put('/trainer/profile', {
        bio: data.bio || null,
        specialization: data.specialization || null,
        yearsOfExperience: data.yearsOfExperience,
      });
      setStatus(t('profile.trainerSaved'));
    } catch {
      setStatus(t('profile.saveError'));
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    'w-full rounded-sm border border-border bg-bg px-4 py-3 text-sm text-text outline-none transition-colors focus:border-border-hv';

  if (fetching) {
    return (
      <div className="rounded-sm border border-border bg-bg2 p-6 text-sm text-text3">
        {t('common.loading')}
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="rounded-sm border border-border bg-bg2 p-6"
    >
      <div className="mb-5">
        <label className="lbl mb-2 block">{t('profile.bio')}</label>
        <textarea
          {...register('bio')}
          rows={4}
          className={`${inputClass} resize-none`}
          placeholder={t('profile.bioPlaceholder')}
        />
        {errors.bio && (
          <p className="mt-1 text-xs text-red">{errors.bio.message}</p>
        )}
      </div>

      <div className="mb-5">
        <label className="lbl mb-2 block">{t('profile.specialization')}</label>
        <input
          {...register('specialization')}
          className={inputClass}
          placeholder={t('profile.specializationPlaceholder')}
        />
        {errors.specialization && (
          <p className="mt-1 text-xs text-red">
            {errors.specialization.message}
          </p>
        )}
      </div>

      <div className="mb-6">
        <label className="lbl mb-2 block">
          {t('profile.yearsOfExperience')}
        </label>
        <input
          type="number"
          min={0}
          max={80}
          {...register('yearsOfExperience')}
          className={inputClass}
        />
        {errors.yearsOfExperience && (
          <p className="mt-1 text-xs text-red">
            {errors.yearsOfExperience.message}
          </p>
        )}
      </div>

      <StatusMessage status={status} errorKey={t('profile.saveError')} />

      <button
        type="submit"
        disabled={loading}
        className="rounded-md bg-text px-6 py-3 text-[13px] font-medium text-bg transition-colors hover:opacity-90 disabled:opacity-50"
      >
        {loading ? t('common.saving') : t('common.save')}
      </button>
    </form>
  );
}

function RolesSection({
  user,
  setUser,
}: {
  user: NonNullable<ReturnType<typeof useAuthStore.getState>['user']>;
  setUser: (u: typeof user) => void;
}) {
  const { t } = useTranslation();
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const hasTrainer = user.roles.includes('Trainer');
  const hasNutritionist = user.roles.includes('Nutritionist');
  const canAddRole = !hasTrainer || !hasNutritionist;

  const handleAddRole = async (role: string) => {
    if (!window.confirm(t('profile.addRoleConfirm'))) return;

    setStatus(null);
    setLoading(true);
    try {
      const data = await addRole(role);
      useAuthStore.getState().setTokens(data.accessToken, data.refreshToken);

      // Re-fetch profile to get updated roles
      const { data: profile } = await api.get('/users/me');
      setUser({
        publicId: profile.userId,
        email: profile.email,
        firstName: profile.firstName,
        lastName: profile.lastName,
        roles: profile.roles ?? [],
      });

      setStatus(t('profile.roleAdded'));
    } catch {
      setStatus(t('profile.addRoleError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mb-6 rounded-sm border border-border bg-bg2 p-6">
      <h3 className="mb-3 text-sm font-semibold">{t('profile.rolesTitle')}</h3>
      <div className="mb-3 flex flex-wrap gap-2">
        {user.roles.map((role) => (
          <span
            key={role}
            className="rounded-sm border border-accent-br bg-accent-bg px-3 py-1 text-xs font-semibold text-accent"
          >
            {t(`auth.role${role}`)}
          </span>
        ))}
      </div>
      {canAddRole && (
        <button
          type="button"
          disabled={loading}
          onClick={() => handleAddRole(hasTrainer ? 'Nutritionist' : 'Trainer')}
          className="rounded-md bg-text px-4 py-2 text-xs font-medium text-bg transition-colors hover:opacity-90 disabled:opacity-50"
        >
          {loading
            ? t('common.saving')
            : hasTrainer
              ? t('profile.addNutritionistRole')
              : t('profile.addTrainerRole')}
        </button>
      )}
      {status && (
        <div className="mt-3">
          <StatusMessage status={status} errorKey={t('profile.addRoleError')} />
        </div>
      )}
    </div>
  );
}

function StatusMessage({
  status,
  errorKey,
}: {
  status: string | null;
  errorKey: string;
}) {
  if (!status) return null;
  return (
    <div
      className={`mb-4 rounded-sm border px-4 py-2.5 text-sm ${
        status === errorKey
          ? 'border-red bg-red-bg text-red'
          : 'border-green bg-green-bg text-green'
      }`}
    >
      {status}
    </div>
  );
}
