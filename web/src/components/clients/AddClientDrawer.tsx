import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { useCreatePendingInvite } from '@/hooks/useClientsQueries';
import { getApiErrorMessage, getErrorCode } from '@/lib/api-errors';

interface FormValues {
  email: string;
  message: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * The "+ Add client" drawer. Collects only an email and an optional message
 * — `CreatePendingInviteValidator` no longer requires a name.
 * `requestedScope` is left unset so the server defaults to the
 * professional's held roles.
 */
export default function AddClientDrawer({ open, onOpenChange }: Props) {
  const { t } = useTranslation();

  const schema = z.object({
    email: z
      .string()
      .min(1, t('clients.addClientDrawer.validation.emailRequired'))
      .email(t('clients.addClientDrawer.validation.emailInvalid')),
    message: z.string().max(500),
  });

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isValid },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: 'onTouched',
    defaultValues: { email: '', message: '' },
  });

  const inviteMutation = useCreatePendingInvite();

  // Inline, coach-rejection error (INVITEE_IS_PROFESSIONAL). The mutation's
  // own onError (useClientsQueries.ts) still raises the usual toast — this
  // is additive, not a replacement: the drawer stays open on any error
  // already, and a screen reader won't reliably announce a toast raised
  // while the drawer holds focus, so this error also gets its own
  // role="alert" text next to the field that caused it.
  const [inviteeError, setInviteeError] = useState<string | null>(null);
  const emailValue = watch('email');

  useEffect(() => {
    if (open) {
      reset({ email: '', message: '' });
      setInviteeError(null);
    }
  }, [open, reset]);

  useEffect(() => {
    setInviteeError(null);
  }, [emailValue]);

  function onSubmit(values: FormValues) {
    inviteMutation.mutate(
      {
        email: values.email,
        message: values.message || null,
      },
      {
        onSuccess: () => {
          onOpenChange(false);
        },
        onError: (error) => {
          if (getErrorCode(error) === 'INVITEE_IS_PROFESSIONAL') {
            setInviteeError(getApiErrorMessage(error, 'clients.addClient.error'));
          }
        },
      },
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{t('clients.addClientDrawer.title')}</SheetTitle>
          <SheetDescription>{t('clients.addClientDrawer.description')}</SheetDescription>
        </SheetHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-1 flex-col gap-4 px-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="add-client-email">{t('clients.addClientDrawer.emailLabel')}</Label>
            <Input
              id="add-client-email"
              type="email"
              autoComplete="email"
              aria-invalid={!!errors.email}
              {...register('email')}
            />
            {errors.email && <p className="text-meta text-destructive">{errors.email.message}</p>}
            {inviteeError && (
              <p role="alert" className="text-meta text-destructive">
                {inviteeError}
              </p>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="add-client-message">{t('clients.addClientDrawer.messageLabel')}</Label>
            <Textarea id="add-client-message" rows={3} {...register('message')} />
          </div>
        </form>
        <SheetFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button type="button" disabled={!isValid || inviteMutation.isPending} onClick={handleSubmit(onSubmit)}>
            {inviteMutation.isPending ? t('common.sending') : t('clients.addClientDrawer.submit')}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
