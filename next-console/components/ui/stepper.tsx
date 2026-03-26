"use client";

import * as React from "react";
import { CheckIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface Step {
  id: string;
  title: string;
  description?: string;
}

interface StepperProps {
  steps: Step[];
  currentStep: number;
  onStepChange?: (step: number) => void;
  allowNavigation?: boolean;
  className?: string;
}

export function Stepper({
  steps,
  currentStep,
  onStepChange,
  allowNavigation = false,
  className,
}: StepperProps) {
  return (
    <nav aria-label="Progress" className={cn("space-y-0", className)}>
      <ol className="flex items-center">
        {steps.map((step, index) => {
          const isCompleted = index < currentStep;
          const isCurrent = index === currentStep;
          const isClickable = allowNavigation && (isCompleted || isCurrent);

          return (
            <li
              key={step.id}
              className={cn(
                "relative",
                index !== steps.length - 1 && "flex-1"
              )}
            >
              <div className="flex items-center">
                <button
                  type="button"
                  onClick={() => isClickable && onStepChange?.(index)}
                  disabled={!isClickable}
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-full border-2 text-sm font-medium transition-colors",
                    isCompleted &&
                      "border-primary bg-primary text-primary-foreground",
                    isCurrent &&
                      "border-primary bg-background text-primary",
                    !isCompleted &&
                      !isCurrent &&
                      "border-muted-foreground/30 bg-background text-muted-foreground",
                    isClickable && "cursor-pointer hover:opacity-80"
                  )}
                >
                  {isCompleted ? (
                    <CheckIcon className="size-4" />
                  ) : (
                    index + 1
                  )}
                </button>
                <div className="ml-3 hidden sm:block">
                  <p
                    className={cn(
                      "text-sm font-medium",
                      isCurrent ? "text-foreground" : "text-muted-foreground"
                    )}
                  >
                    {step.title}
                  </p>
                  {step.description && (
                    <p className="text-xs text-muted-foreground">
                      {step.description}
                    </p>
                  )}
                </div>
                {index !== steps.length - 1 && (
                  <div
                    className={cn(
                      "ml-4 h-0.5 flex-1",
                      isCompleted ? "bg-primary" : "bg-muted-foreground/30"
                    )}
                  />
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

interface StepperContentProps {
  children: React.ReactNode;
  className?: string;
}

export function StepperContent({ children, className }: StepperContentProps) {
  return <div className={cn("flex-1", className)}>{children}</div>;
}

interface StepperActionsProps {
  children: React.ReactNode;
  className?: string;
}

export function StepperActions({ children, className }: StepperActionsProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 border-t pt-4",
        className
      )}
    >
      {children}
    </div>
  );
}