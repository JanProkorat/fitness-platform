import React from 'react';
import { cn } from '@/lib/cn';

interface RegisterStepIndicatorProps {
  step: number;
}

export function RegisterStepIndicator({ step }: RegisterStepIndicatorProps) {
  const steps = [1, 2, 3] as const;
  return (
    <div className="auth-step-indicator">
      {steps.map((s, i) => (
        <React.Fragment key={s}>
          <div
            className={cn(
              'auth-step',
              step === s && 'active',
              step > s && 'done',
            )}
          >
            {step > s ? '✓' : s}
          </div>
          {i < steps.length - 1 && <div className="auth-step-line" />}
        </React.Fragment>
      ))}
    </div>
  );
}
