import { CheckIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

interface RegisterStepperProps {
  /** 1 = filling in the account form, 2 = waiting for email verification, 3 = verified. */
  current: 1 | 2 | 3;
  /** Label of the last step: coaches set up a profile, clients get the app. */
  finalStep: 'profile' | 'getApp';
}

function StepMarker({ state, number }: { state: 'done' | 'current' | 'todo'; number: number }) {
  return (
    <span
      className={cn(
        'box-border flex size-6.5 shrink-0 items-center justify-center rounded-full text-meta font-bold',
        state === 'done' && 'bg-primary text-primary-foreground',
        state === 'current' && 'bg-marker text-on-dark',
        state === 'todo' && 'border-[1.5px] border-border text-muted-foreground'
      )}
    >
      {state === 'done' ? <CheckIcon className="size-3.5" strokeWidth={2.6} aria-hidden="true" /> : number}
    </span>
  );
}

/** Three-step progress header of the register card. */
export default function RegisterStepper({ current, finalStep }: RegisterStepperProps) {
  const { t } = useTranslation();

  const steps = [
    { label: t('entry.register.steps.account') },
    { label: t('entry.register.steps.verify') },
    { label: t(`entry.register.steps.${finalStep}`) },
  ];

  return (
    <ol aria-label={t('entry.register.steps.label')} className="flex items-center gap-3">
      {steps.map((step, index) => {
        const number = index + 1;
        const state = number < current ? 'done' : number === current ? 'current' : 'todo';
        return (
          <li
            key={number}
            aria-current={state === 'current' ? 'step' : undefined}
            className={cn('flex items-center gap-3', index < steps.length - 1 && 'flex-1')}
          >
            <span
              className={cn(
                'flex items-center gap-2 text-body whitespace-nowrap',
                state === 'todo' ? 'font-medium text-muted-foreground' : 'text-ink',
                state === 'current' && 'font-bold'
              )}
            >
              <StepMarker state={state} number={number} />
              {/* Only the current step keeps its label on phones so three steps fit. */}
              <span className={cn(state !== 'current' && 'hidden sm:inline')}>{step.label}</span>
            </span>
            {index < steps.length - 1 && (
              <span
                aria-hidden="true"
                className={cn(
                  'h-0.5 flex-1 rounded-full',
                  number < current ? 'bg-primary' : 'bg-line'
                )}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
