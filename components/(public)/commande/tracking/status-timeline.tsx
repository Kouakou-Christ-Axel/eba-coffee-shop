'use client';

import { m } from 'framer-motion';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { STATUS_STEPS } from './constants';

export function StatusTimeline({
  currentStep,
  reduceMotion,
}: {
  currentStep: number;
  reduceMotion: boolean | null;
}) {
  return (
    <div className="rounded-xl border border-foreground/10 bg-default-50 p-5">
      <ol className="flex items-start">
        {STATUS_STEPS.map((step, i) => {
          const done = i < currentStep;
          const active = i === currentStep;
          const StepIcon = step.Icon;
          return (
            <li key={step.status} className="flex flex-1 flex-col items-center">
              <div className="flex w-full items-center">
                <div
                  className={cn(
                    'h-0.5 flex-1',
                    i === 0
                      ? 'bg-transparent'
                      : i <= currentStep
                        ? 'bg-primary'
                        : 'bg-foreground/15'
                  )}
                />
                <m.div
                  initial={false}
                  animate={
                    active && !reduceMotion ? { scale: [1, 1.12, 1] } : {}
                  }
                  transition={{ duration: 1.6, repeat: Infinity }}
                  className={cn(
                    'flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2',
                    done || active
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-foreground/20 bg-background text-foreground/40'
                  )}
                >
                  {done ? (
                    <Check className="h-4 w-4" strokeWidth={3} />
                  ) : (
                    <StepIcon className="h-4 w-4" />
                  )}
                </m.div>
                <div
                  className={cn(
                    'h-0.5 flex-1',
                    i === STATUS_STEPS.length - 1
                      ? 'bg-transparent'
                      : i < currentStep
                        ? 'bg-primary'
                        : 'bg-foreground/15'
                  )}
                />
              </div>
              <p
                className={cn(
                  'mt-2 px-1 text-center text-[11px] font-medium leading-tight',
                  active
                    ? 'text-primary'
                    : done
                      ? 'text-foreground/70'
                      : 'text-foreground/40'
                )}
              >
                {step.label}
              </p>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
