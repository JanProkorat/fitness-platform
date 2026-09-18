import { useMemo } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import axios from 'axios';
import { register as registerAccount } from '@/api/auth';
import { getApiErrorMessage, getErrorCode } from '@/lib/api-errors';
import { passwordMeetsAllRules } from '@/lib/password-rules';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import RoleSelector, { type RegistrableRole } from '@/components/entry/RoleSelector';
import PasswordStrengthRules from '@/components/entry/PasswordStrengthRules';
import VerificationSentState from '@/components/entry/VerificationSentState';

interface RegisterFormValues {
  roles: RegistrableRole[];
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  gdprConsent: boolean;
}

/**
 * RegisterEndpoint has no machine-readable code for a duplicate email — it
 * pipes ASP.NET Identity's IdentityResult errors through as a bare English
 * `errors[].reason` (e.g. "Email 'x' is already taken."). Match it
 * heuristically rather than looking up an `apiErrors.*` translation key
 * (design-review error path — see `api/auth.ts#register`).
 */
const DUPLICATE_EMAIL_PATTERN = /already taken|already registered/i;

/**
 * Register form — role picker, name/email/password fields, live password
 * rules, and the single GDPR consent checkbox (prototype
 * `[data-form="register"]`, scratchpad gf-register.html). Renders
 * VerificationSentState in place of the fields once `registerMutation`
 * succeeds — that state is the RESULT of the mutation, not a route: the
 * URL stays `/register`, and nothing about the submitted email is
 * persisted to storage (design-review error path — a page reload must
 * degrade back to this empty form, never resurrect a stale "check your
 * email" screen for an address the user already corrected).
 */
export default function RegisterForm() {
  const { t } = useTranslation();

  const registerSchema = useMemo(
    () =>
      z.object({
        roles: z
          .array(z.enum(['Trainer', 'Nutritionist']))
          .min(1, t('entry.register.validation.roleRequired')),
        firstName: z.string().min(1, t('entry.register.validation.firstNameRequired')),
        lastName: z.string().min(1, t('entry.register.validation.lastNameRequired')),
        email: z
          .string()
          .min(1, t('entry.register.validation.emailRequired'))
          .email(t('entry.register.validation.emailInvalid')),
        password: z
          .string()
          .refine(passwordMeetsAllRules, t('entry.register.validation.passwordInvalid')),
        gdprConsent: z
          .boolean()
          .refine((consented) => consented === true, {
            message: t('entry.register.validation.consentRequired'),
          }),
      }),
    [t]
  );

  const {
    register,
    control,
    handleSubmit,
    watch,
    setError,
    formState: { errors, isValid },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    // 'onTouched', not 'onBlur' — confirmed the difference matters in a real
    // browser, not assumed. A field's FIRST validation trigger is still its
    // blur (so nobody gets shouted at mid-keystroke on a field they haven't
    // finished typing into yet — verified: typing an invalid email character
    // by character shows zero errors until focus leaves the field). The
    // difference is what happens AFTER that first blur: 'onTouched' also
    // revalidates on every subsequent change, where plain 'onBlur' does not.
    //
    // That difference is what unlocks the submit button without an extra
    // click or Tab. Every registered/Controller-driven field here has
    // field.onBlur wired (see RoleSelector's `onBlur` prop and the
    // gdprConsent Checkbox below) — necessary but NOT sufficient on its own:
    // under plain 'onBlur' mode, ticking the consent checkbox (normally the
    // user's last action) still left the button locked until focus moved
    // away, because isValid only gets recomputed by a validation trigger,
    // and the checkbox's own change doesn't fire one under 'onBlur' — only
    // its (separate, later) blur would. 'onTouched' closes that gap: once a
    // field has been touched at all, RHF revalidates on its onChange too, so
    // the checkbox's own toggle now triggers the same full-form
    // isValid recompute its blur used to. Verified: filling every field and
    // ticking consent LAST, with no blur/Tab/click afterward at all, the
    // button is enabled the moment consent is ticked.
    //
    // The disabled submit button is still the primary guard against the
    // original "six errors at once" bulk dump: a disabled button can't be
    // clicked and can't be reached by the browser's implicit Enter-key
    // submission. The form's onSubmit below adds a second, explicit
    // `!isValid` guard for the one remaining path — a submission forced past
    // the disabled attribute (e.g. via devtools) — so handleSubmit's own
    // full-schema validation (unscoped, unlike a targeted blur/change
    // trigger) never runs and never re-populates every invalid field's error
    // at once.
    mode: 'onTouched',
    defaultValues: {
      roles: [],
      firstName: '',
      lastName: '',
      email: '',
      password: '',
      gdprConsent: false,
    },
  });

  const password = watch('password');

  const registerMutation = useMutation({
    mutationFn: (values: RegisterFormValues) =>
      registerAccount({
        email: values.email,
        password: values.password,
        confirmPassword: values.password,
        firstName: values.firstName,
        lastName: values.lastName,
        roles: values.roles,
        gdprConsent: values.gdprConsent,
        // healthDataConsent intentionally omitted, not set to a literal
        // null: RegisterValidator.cs:73-83 requires null for Trainer and
        // Nutritionist, and an absent JSON field binds to the same null an
        // explicit one would.
      }),
    onError: (error) => {
      if (axios.isAxiosError(error) && error.response?.status === 400) {
        const reason = getErrorCode(error) ?? '';
        if (DUPLICATE_EMAIL_PATTERN.test(reason)) {
          setError('email', {
            type: 'server',
            message: t('entry.register.errors.duplicateEmail'),
          });
        }
      }
    },
  });

  const resolveBannerErrorMessage = (error: unknown): string | null => {
    if (axios.isAxiosError(error)) {
      const reason = getErrorCode(error) ?? '';
      if (error.response?.status === 400 && DUPLICATE_EMAIL_PATTERN.test(reason)) {
        // Rendered on the email field instead — see registerMutation.onError above.
        return null;
      }
      if (error.response?.status === 429) {
        return t('errors.rateLimitRefresh');
      }
      if (!error.response) {
        return t('entry.register.errors.network');
      }
      return getApiErrorMessage(error, 'entry.register.errors.generic');
    }
    return t('entry.register.errors.generic');
  };

  const bannerErrorMessage = registerMutation.isError
    ? resolveBannerErrorMessage(registerMutation.error)
    : null;

  const onSubmit = (values: RegisterFormValues) => {
    registerMutation.mutate(values);
  };

  if (registerMutation.isSuccess) {
    return (
      <VerificationSentState
        email={registerMutation.variables?.email ?? ''}
        onWrongEmail={() => registerMutation.reset()}
      />
    );
  }

  return (
    <>
      <div>
        <h3 className="text-auth-title font-bold text-ink">{t('entry.register.title')}</h3>
        <p className="mt-1.5 text-meta text-muted-foreground">{t('entry.register.lede')}</p>
      </div>

      <form
        onSubmit={(event) => {
          // Defense in depth: the disabled submit button already prevents a
          // real user from reaching this handler while the form is invalid
          // (a disabled button can't be clicked and can't be the target of
          // the browser's implicit Enter-key submission). This guard closes
          // the one remaining path — a submission forced past the disabled
          // attribute (e.g. via devtools) — from calling handleSubmit's own
          // full-schema validation, which would otherwise populate every
          // invalid field's error at once, reintroducing the bulk dump this
          // whole rework exists to prevent.
          if (!isValid) {
            event.preventDefault();
            return;
          }
          void handleSubmit(onSubmit)(event);
        }}
        noValidate
        className="flex flex-col gap-4.5"
      >
        <Controller
          control={control}
          name="roles"
          render={({ field }) => (
            <RoleSelector
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              error={errors.roles?.message}
            />
          )}
        />

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="entry-firstName">{t('entry.register.firstNameLabel')}</Label>
            <Input
              id="entry-firstName"
              autoComplete="given-name"
              placeholder={t('entry.register.firstNamePlaceholder')}
              aria-invalid={!!errors.firstName}
              aria-describedby={errors.firstName ? 'entry-firstName-error' : undefined}
              {...register('firstName')}
            />
            {errors.firstName && (
              <p id="entry-firstName-error" className="text-meta text-destructive">
                {errors.firstName.message}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="entry-lastName">{t('entry.register.lastNameLabel')}</Label>
            <Input
              id="entry-lastName"
              autoComplete="family-name"
              placeholder={t('entry.register.lastNamePlaceholder')}
              aria-invalid={!!errors.lastName}
              aria-describedby={errors.lastName ? 'entry-lastName-error' : undefined}
              {...register('lastName')}
            />
            {errors.lastName && (
              <p id="entry-lastName-error" className="text-meta text-destructive">
                {errors.lastName.message}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="entry-register-email">{t('entry.register.emailLabel')}</Label>
          <Input
            id="entry-register-email"
            type="email"
            autoComplete="email"
            placeholder={t('entry.register.emailPlaceholder')}
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? 'entry-register-email-error' : undefined}
            {...register('email')}
          />
          {errors.email && (
            <p id="entry-register-email-error" className="text-meta text-destructive">
              {errors.email.message}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="entry-register-password">{t('entry.register.passwordLabel')}</Label>
          <Input
            id="entry-register-password"
            type="password"
            autoComplete="new-password"
            placeholder="••••••••"
            aria-invalid={!!errors.password}
            aria-describedby="entry-register-password-rules"
            {...register('password')}
          />
          <div id="entry-register-password-rules">
            <PasswordStrengthRules password={password} />
          </div>
        </div>

        <Controller
          control={control}
          name="gdprConsent"
          render={({ field }) => (
            <label
              htmlFor="entry-gdpr-consent"
              className="flex items-start gap-2.5 text-meta text-ink-2"
            >
              <Checkbox
                id="entry-gdpr-consent"
                className="mt-0.5"
                checked={field.value}
                aria-invalid={!!errors.gdprConsent}
                onCheckedChange={(checked) => field.onChange(checked === true)}
                onBlur={field.onBlur}
              />
              <span>{t('entry.register.consentLabel')}</span>
            </label>
          )}
        />
        {errors.gdprConsent && (
          <p className="text-meta text-destructive">{errors.gdprConsent.message}</p>
        )}

        {bannerErrorMessage && (
          <p role="alert" className="text-meta text-destructive">
            {bannerErrorMessage}
          </p>
        )}

        <Button
          type="submit"
          disabled={!isValid || registerMutation.isPending}
          aria-describedby={!isValid ? 'entry-register-submit-hint' : undefined}
          className="w-full"
        >
          {registerMutation.isPending ? t('entry.register.submitting') : t('entry.register.submit')}
        </Button>
        {/*
          Fixed-position, always-rendered hint — reserves its line height
          whether or not it is showing, so the panel never grows/shifts as
          validity changes (the layout-jump the user rejected). One quiet
          line, never an enumeration of which fields are missing.
        */}
        <p
          id="entry-register-submit-hint"
          className={cn('text-caption text-muted-foreground', isValid && 'invisible')}
        >
          {t('entry.register.submitHint')}
        </p>
      </form>

      <p className="text-meta text-muted-foreground">
        {t('entry.register.haveAccount')}{' '}
        <Link to="/" className="font-medium text-brand hover:underline">
          {t('entry.register.signIn')}
        </Link>
      </p>
    </>
  );
}
