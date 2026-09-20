import { useEffect } from 'react';
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

interface FormValues {
  firstName: string;
  lastName: string;
  email: string;
  message: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * The "+ Add client" drawer. Deliberately collects first name, last name and
 * email, not email-only: `CreatePendingInviteValidator` requires FirstName
 * and LastName non-empty alongside Email, so an email-only form would 400 on
 * every submit (design-review error path). `requestedScope` is left unset so
 * the server defaults to the professional's held roles.
 */
export default function AddClientDrawer({ open, onOpenChange }: Props) {
  const { t } = useTranslation();

  const schema = z.object({
    firstName: z.string().min(1, t('clients.addClientDrawer.validation.firstNameRequired')),
    lastName: z.string().min(1, t('clients.addClientDrawer.validation.lastNameRequired')),
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
    formState: { errors, isValid },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: 'onTouched',
    defaultValues: { firstName: '', lastName: '', email: '', message: '' },
  });

  const inviteMutation = useCreatePendingInvite();

  useEffect(() => {
    if (open) {
      reset({ firstName: '', lastName: '', email: '', message: '' });
    }
  }, [open, reset]);

  function onSubmit(values: FormValues) {
    inviteMutation.mutate(
      {
        firstName: values.firstName,
        lastName: values.lastName,
        email: values.email,
        message: values.message || null,
      },
      {
        onSuccess: () => {
          onOpenChange(false);
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
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="add-client-firstName">{t('clients.addClientDrawer.firstNameLabel')}</Label>
              <Input
                id="add-client-firstName"
                autoComplete="given-name"
                aria-invalid={!!errors.firstName}
                {...register('firstName')}
              />
              {errors.firstName && <p className="text-meta text-destructive">{errors.firstName.message}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="add-client-lastName">{t('clients.addClientDrawer.lastNameLabel')}</Label>
              <Input
                id="add-client-lastName"
                autoComplete="family-name"
                aria-invalid={!!errors.lastName}
                {...register('lastName')}
              />
              {errors.lastName && <p className="text-meta text-destructive">{errors.lastName.message}</p>}
            </div>
          </div>
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
