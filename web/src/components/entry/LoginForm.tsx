import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import axios from 'axios';
import { Apple, EyeIcon, EyeOffIcon, PlayCircle } from 'lucide-react';
import { login as loginRequest } from '@/api/auth';
import { getMyProfile } from '@/api/profile';
import type { GetProfileResponse } from '@/api/generated';
import { useAuthStore } from '@/stores/auth';
import { getApiErrorMessage } from '@/lib/api-errors';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';

/**
 * Distinguishes "login succeeded but the follow-up profile fetch failed"
 * (design-review error path: tokens are already persisted, the mutation
 * has already logged the half-authenticated session out by the time this
 * is thrown) from a rejected login request itself, which the mutation's
 * error handler resolves via getApiErrorMessage + the network-error check
 * instead.
 */
class ProfileLoadError extends Error {}

interface LoginFormValues {
  email: string;
  password: string;
}

/**
 * Login form — email/password fields, Google/Apple (disabled, see below),
 * and the links into the register / forgot-password routes (spec §6 /
 * prototype `.auth`). Rendered inside LoginPanel's swap area at "/"
 * (App.tsx's pathless layout route under EntryPage).
 *
 * Google and Apple sign-in ship disabled for this issue: there is no Google
 * client id configured in this repo's env, Apple needs a domain-verified
 * Services ID the compose harness cannot exercise, and the social-nonce
 * flow is epic item 2's to own (see design-review finding, issue Notes).
 *
 * "Keep me signed in" is rendered but not wired to any request field —
 * the backend issues the same 15-minute access / 7-day refresh token pair
 * regardless, so there is no differing behaviour for this checkbox to
 * control yet.
 */
export default function LoginForm() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const setTokens = useAuthStore((s) => s.setTokens);
  const storeLogin = useAuthStore((s) => s.login);
  const storeLogout = useAuthStore((s) => s.logout);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  const loginSchema = useMemo(
    () =>
      z.object({
        email: z
          .string()
          .min(1, t('entry.login.validation.emailRequired'))
          .email(t('entry.login.validation.emailInvalid')),
        password: z.string().min(1, t('entry.login.validation.passwordRequired')),
      }),
    [t]
  );

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const loginMutation = useMutation({
    mutationFn: async ({ email, password }: LoginFormValues) => {
      const { accessToken, refreshToken } = await loginRequest(email, password);
      if (!accessToken || !refreshToken) {
        throw new ProfileLoadError('missing-tokens');
      }
      setTokens(accessToken, refreshToken);

      let profile: GetProfileResponse;
      try {
        profile = await getMyProfile();
      } catch {
        // Tokens are already persisted — a half-authenticated session must
        // not linger (design-review error path: login ok, /users/me failed).
        storeLogout();
        throw new ProfileLoadError('profile-load-failed');
      }

      storeLogin(
        {
          publicId: profile.userId ?? '',
          email: profile.email ?? '',
          firstName: profile.firstName ?? '',
          lastName: profile.lastName ?? '',
          roles: profile.roles ?? [],
          emailConfirmed: profile.emailConfirmed ?? true,
          avatarBlobUrl: profile.avatarBlobUrl ?? null,
        },
        accessToken,
        refreshToken
      );
    },
    onSuccess: () => {
      navigate('/clients', { replace: true });
    },
  });

  const resolveErrorMessage = (error: unknown): string => {
    if (error instanceof ProfileLoadError) {
      return t('entry.login.errors.profileLoadFailed');
    }
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 429) {
        return t('errors.rateLimitRefresh');
      }
      if (!error.response) {
        return t('entry.login.errors.network');
      }
      return getApiErrorMessage(error, 'entry.login.errors.generic');
    }
    return t('entry.login.errors.generic');
  };

  const errorMessage = loginMutation.isError ? resolveErrorMessage(loginMutation.error) : null;

  const onSubmit = (values: LoginFormValues) => {
    loginMutation.mutate(values);
  };

  return (
    <>
      <div>
        <h3 className="text-auth-title font-bold text-ink">{t('entry.login.title')}</h3>
        <p className="mt-1.5 text-meta text-muted-foreground">{t('entry.login.lede')}</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4.5">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="entry-email">{t('entry.login.emailLabel')}</Label>
          <Input
            id="entry-email"
            type="email"
            autoComplete="email"
            placeholder={t('entry.login.emailPlaceholder')}
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? 'entry-email-error' : undefined}
            {...register('email')}
          />
          {errors.email && (
            <p id="entry-email-error" className="text-meta text-destructive">
              {errors.email.message}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="entry-password">{t('entry.login.passwordLabel')}</Label>
          <div className="relative">
            <Input
              id="entry-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="••••••••"
              aria-invalid={!!errors.password}
              aria-describedby={errors.password ? 'entry-password-error' : undefined}
              className="pr-16"
              {...register('password')}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={
                showPassword ? t('entry.login.hidePassword') : t('entry.login.showPassword')
              }
              className="absolute inset-y-0 right-2 inline-flex items-center gap-1 text-caption font-semibold text-muted-foreground"
            >
              {showPassword ? (
                <EyeOffIcon className="size-3.5" />
              ) : (
                <EyeIcon className="size-3.5" />
              )}
              {showPassword ? t('entry.login.hidePassword') : t('entry.login.showPassword')}
            </button>
          </div>
          {errors.password && (
            <p id="entry-password-error" className="text-meta text-destructive">
              {errors.password.message}
            </p>
          )}
        </div>

        <div className="flex items-baseline justify-between gap-3">
          <Label htmlFor="entry-remember" className="text-muted-foreground">
            <Checkbox
              id="entry-remember"
              checked={rememberMe}
              onCheckedChange={(checked) => setRememberMe(checked === true)}
            />
            {t('entry.login.rememberMe')}
          </Label>
          <Link
            to="/forgot-password"
            className="text-meta font-medium text-brand hover:underline"
          >
            {t('entry.login.forgotPassword')}
          </Link>
        </div>

        {errorMessage && (
          <p role="alert" className="text-meta text-destructive">
            {errorMessage}
          </p>
        )}

        <Button type="submit" disabled={loginMutation.isPending} className="w-full">
          {loginMutation.isPending ? t('entry.login.submitting') : t('entry.login.submit')}
        </Button>
      </form>

      <div className="flex items-center gap-3 text-caption tracking-[.1em] text-faint uppercase">
        <span className="h-px flex-1 bg-border" />
        <span>{t('entry.login.or')}</span>
        <span className="h-px flex-1 bg-border" />
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <Button type="button" variant="outline" disabled title={t('entry.login.googleComingSoon')}>
          {t('entry.login.google')}
        </Button>
        <Button type="button" variant="outline" disabled title={t('entry.login.appleComingSoon')}>
          {t('entry.login.apple')}
        </Button>
      </div>

      {/*
       * Client signpost (#1058 AC 8) — login form only. Someone already
       * filling in the register or forgot-password form has shown which
       * side they are on; repeating this there would just be noise
       * (explicit product decision, prototype `scratchpad/gf-register.html`
       * lines ~447-456).
       */}
      <div className="flex flex-col gap-2.5 rounded-md border border-border bg-sunken p-3.5">
        <p className="text-meta text-muted-foreground">
          <strong className="font-semibold text-ink">{t('entry.login.clientNote.lead')}</strong>{' '}
          {t('entry.login.clientNote.body')}
        </p>
        <div className="flex flex-wrap gap-2">
          <a href="#" className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'gap-1.5')}>
            <Apple className="size-3.5" />
            {t('entry.login.clientNote.appStore')}
          </a>
          <a href="#" className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'gap-1.5')}>
            <PlayCircle className="size-3.5" />
            {t('entry.login.clientNote.googlePlay')}
          </a>
        </div>
      </div>

      <p className="text-meta text-muted-foreground">
        {t('entry.login.noAccount')}{' '}
        <Link to="/register" className="font-medium text-brand hover:underline">
          {t('entry.login.createAccount')}
        </Link>
      </p>
    </>
  );
}
