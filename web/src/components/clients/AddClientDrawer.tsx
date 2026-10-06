import { useState, type ReactNode } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { Check, ChevronDown, ClipboardList, Mail, MessageSquare, Send, Target } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { LinkCapabilityScope } from '@/api/generated';
import { useCreatePendingInvite } from '@/hooks/useClientsQueries';
import { useTrainerQuestionnaires } from '@/hooks/useQuestionnaireQueries';
import { useAuthStore } from '@/stores/auth';
import { cn } from '@/lib/utils';

const EMAIL_MAX_LENGTH = 100;
const MESSAGE_MAX_LENGTH = 500;
const NO_QUESTIONNAIRE = '';

interface FormValues {
  email: string;
  message: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SCOPE_OPTIONS: { value: LinkCapabilityScope; labelKey: string }[] = [
  { value: LinkCapabilityScope.TrainingOnly, labelKey: 'clients.addClientDrawer.scope.training' },
  { value: LinkCapabilityScope.NutritionOnly, labelKey: 'clients.addClientDrawer.scope.nutrition' },
  { value: LinkCapabilityScope.Both, labelKey: 'clients.addClientDrawer.scope.both' },
];

function Section({ icon, title, hint, children }: { icon: ReactNode; title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="flex items-center gap-2 text-subhead font-semibold text-foreground">
        <span className="flex text-nutrition [&_svg]:size-4" aria-hidden="true">
          {icon}
        </span>
        {title}
        {hint && <span className="text-body font-normal text-muted-foreground">{hint}</span>}
      </h3>
      {children}
    </section>
  );
}

/**
 * The "Invite client" drawer. `requestedScope` is sent only by a professional
 * holding both roles; a single-role professional sends none, so the server
 * defaults to the roles they hold.
 */
export default function AddClientDrawer({ open, onOpenChange }: Props) {
  const { t } = useTranslation();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 p-0 sm:w-drawer sm:max-w-none">
        <SheetHeader className="gap-1 border-b border-border px-6 py-5">
          <SheetTitle className="font-display text-card-title">{t('clients.addClientDrawer.title')}</SheetTitle>
          <SheetDescription className="text-body">{t('clients.addClientDrawer.description')}</SheetDescription>
        </SheetHeader>
        <InviteForm onClose={() => onOpenChange(false)} />
      </SheetContent>
    </Sheet>
  );
}

function InviteForm({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const roles = useAuthStore((state) => state.user?.roles ?? []);
  const isDualRole = roles.includes('Trainer') && roles.includes('Nutritionist');

  const [scope, setScope] = useState<LinkCapabilityScope>(LinkCapabilityScope.Both);
  const [questionnaireChoice, setQuestionnaireChoice] = useState<string | undefined>(undefined);

  const questionnairesQuery = useTrainerQuestionnaires();
  const activeQuestionnaires = (questionnairesQuery.data ?? []).filter((questionnaire) => questionnaire.isActive);
  const defaultQuestionnaireId =
    activeQuestionnaires.find((questionnaire) => questionnaire.isDefault)?.publicId ?? NO_QUESTIONNAIRE;
  const questionnaireId = questionnaireChoice ?? defaultQuestionnaireId;

  const schema = z.object({
    email: z
      .string()
      .min(1, t('clients.addClientDrawer.validation.emailRequired'))
      .email(t('clients.addClientDrawer.validation.emailInvalid'))
      .max(EMAIL_MAX_LENGTH, t('clients.addClientDrawer.validation.emailTooLong')),
    message: z.string().max(MESSAGE_MAX_LENGTH, t('clients.addClientDrawer.validation.messageTooLong')),
  });

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isValid },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: 'onTouched',
    defaultValues: { email: '', message: '' },
  });

  const inviteMutation = useCreatePendingInvite();
  const messageLength = useWatch({ control, name: 'message' }).length;
  const messageTooLong = messageLength > MESSAGE_MAX_LENGTH;

  function onSubmit(values: FormValues) {
    inviteMutation.mutate(
      {
        email: values.email,
        message: values.message || null,
        questionnairePublicId: questionnaireId === NO_QUESTIONNAIRE ? null : questionnaireId,
        ...(isDualRole ? { requestedScope: scope } : {}),
      },
      { onSuccess: onClose },
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-6 py-5">
        <Section icon={<Mail />} title={t('clients.addClientDrawer.sections.client')}>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="add-client-email">
              {t('clients.addClientDrawer.emailLabel')}
              <span className="text-error" aria-hidden="true">
                {' *'}
              </span>
            </Label>
            <Input
              id="add-client-email"
              type="email"
              autoComplete="email"
              className="h-10"
              aria-invalid={!!errors.email}
              {...register('email')}
            />
            {errors.email ? (
              <p className="text-meta text-destructive">{errors.email.message}</p>
            ) : (
              <p className="text-meta text-muted-foreground">{t('clients.addClientDrawer.emailHelper')}</p>
            )}
          </div>
        </Section>

        {isDualRole && (
          <Section icon={<Target />} title={t('clients.addClientDrawer.sections.scope')}>
            <div role="group" aria-label={t('clients.addClientDrawer.sections.scope')} className="grid grid-cols-3 gap-2">
              {SCOPE_OPTIONS.map((option) => {
                const isSelected = scope === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => setScope(option.value)}
                    className={cn(
                      'inline-flex h-10 items-center justify-center gap-1.5 rounded-field border px-3 text-body font-semibold outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
                      isSelected
                        ? 'border-nutrition bg-nutrition-soft text-nutrition-ink'
                        : 'border-border bg-background text-foreground hover:bg-muted',
                    )}
                  >
                    {isSelected && <Check className="size-4" aria-hidden="true" />}
                    {t(option.labelKey)}
                  </button>
                );
              })}
            </div>
            <p className="text-meta text-muted-foreground">{t('clients.addClientDrawer.scopeHelper')}</p>
          </Section>
        )}

        <Section icon={<ClipboardList />} title={t('clients.addClientDrawer.sections.onboarding')}>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="add-client-questionnaire">{t('clients.addClientDrawer.questionnaireLabel')}</Label>
            <div className="relative">
              <select
                id="add-client-questionnaire"
                value={questionnaireId}
                disabled={questionnairesQuery.isPending}
                onChange={(event) => setQuestionnaireChoice(event.target.value)}
                className="h-10 w-full appearance-none rounded-field border border-input bg-background pr-9 pl-3 text-body text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value={NO_QUESTIONNAIRE}>{t('clients.addClientDrawer.questionnaireNone')}</option>
                {activeQuestionnaires.map((questionnaire) => (
                  <option key={questionnaire.publicId} value={questionnaire.publicId}>
                    {t('clients.addClientDrawer.questionnaireOption', {
                      title: questionnaire.title,
                      count: questionnaire.questionCount,
                    })}
                  </option>
                ))}
              </select>
              <ChevronDown
                className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
            </div>
            {questionnairesQuery.isError ? (
              <p className="text-meta text-destructive">{t('clients.addClientDrawer.questionnaireLoadError')}</p>
            ) : (
              <p className="text-meta text-muted-foreground">{t('clients.addClientDrawer.questionnaireHelper')}</p>
            )}
          </div>
        </Section>

        <Section
          icon={<MessageSquare />}
          title={t('clients.addClientDrawer.sections.message')}
          hint={t('clients.addClientDrawer.optional')}
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="add-client-message">{t('clients.addClientDrawer.messageLabel')}</Label>
            <Textarea
              id="add-client-message"
              rows={4}
              className="min-h-26 resize-none"
              aria-invalid={messageTooLong}
              {...register('message')}
            />
            <span
              className={cn('self-end text-meta', messageTooLong ? 'text-destructive' : 'text-muted-foreground')}
              aria-live="polite"
            >
              {`${messageLength} / ${MESSAGE_MAX_LENGTH}`}
            </span>
          </div>
        </Section>
      </div>

      <div className="flex items-center gap-2 border-t border-border px-6 py-4">
        <span className="text-meta text-muted-foreground">{t('clients.addClientDrawer.footerNote')}</span>
        <span className="ml-auto" />
        <Button type="button" variant="outline" size="lg" className="px-3.5" onClick={onClose}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" size="lg" className="gap-1.75 px-3.5" disabled={!isValid || inviteMutation.isPending}>
          <Send aria-hidden="true" />
          {inviteMutation.isPending ? t('common.sending') : t('clients.addClientDrawer.submit')}
        </Button>
      </div>
    </form>
  );
}
