"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  chooseUsernameAction,
  demoLoginAction,
  googleSignInAction,
  logInAction,
  signUpAction,
} from "@/server/actions/auth";
import type { ActionResult } from "@/lib/validators";
import { cn } from "@/lib/utils";

function Field({
  name,
  label,
  error,
  ...props
}: React.ComponentProps<typeof Input> & { name: string; label: string; error?: string[] }) {
  const id = `field-${name}`;
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id} className="text-muted-foreground">
        {label}
      </Label>
      <Input
        id={id}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className="h-11 rounded-xl"
        {...props}
      />
      {error && (
        <p id={`${id}-error`} className="text-xs text-loss">
          {error[0]}
        </p>
      )}
    </div>
  );
}

function SubmitButton({ children, className }: { children: React.ReactNode; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      size="lg"
      disabled={pending}
      className={cn("h-11 w-full rounded-xl text-base font-semibold", className)}
    >
      {pending ? <Loader2 className="animate-spin" /> : children}
    </Button>
  );
}

function FormError({ state }: { state: ActionResult | undefined }) {
  if (!state || state.ok) return null;
  return (
    <p role="alert" className="rounded-xl border border-loss/30 bg-loss/10 px-3 py-2 text-sm text-loss">
      {state.error}
    </p>
  );
}

function fieldErrors(state: ActionResult | undefined) {
  return state && !state.ok ? (state.fieldErrors ?? {}) : {};
}

export function LogInForm({ next }: { next?: string }) {
  const [state, action] = useActionState(logInAction, undefined);
  const errors = fieldErrors(state);
  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="next" value={next ?? ""} />
      <Field name="email" label="Email" type="email" autoComplete="email" required error={errors.email} />
      <Field
        name="password"
        label="Password"
        type="password"
        autoComplete="current-password"
        required
        error={errors.password}
      />
      <FormError state={state} />
      <SubmitButton>Log in</SubmitButton>
    </form>
  );
}

export function SignUpForm({ next }: { next?: string }) {
  const [state, action] = useActionState(signUpAction, undefined);
  const errors = fieldErrors(state);
  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="next" value={next ?? ""} />
      <Field name="email" label="Email" type="email" autoComplete="email" required error={errors.email} />
      <Field
        name="username"
        label="Username"
        autoComplete="username"
        placeholder="e.g. wolf_of_main_st"
        required
        minLength={3}
        maxLength={20}
        error={errors.username}
      />
      <Field
        name="password"
        label="Password"
        type="password"
        autoComplete="new-password"
        placeholder="At least 8 characters"
        required
        minLength={8}
        error={errors.password}
      />
      <FormError state={state} />
      <SubmitButton>Create account · get $10,000</SubmitButton>
    </form>
  );
}

export function UsernameForm() {
  const [state, action] = useActionState(chooseUsernameAction, undefined);
  const errors = fieldErrors(state);
  return (
    <form action={action} className="grid gap-4">
      <Field name="username" label="Username" autoComplete="username" required autoFocus error={errors.username} />
      <FormError state={state} />
      <SubmitButton>Let&apos;s trade</SubmitButton>
    </form>
  );
}

export function DemoButton({ className, children }: { className?: string; children?: React.ReactNode }) {
  const [state, action] = useActionState(demoLoginAction, undefined);
  return (
    <form action={action} className={className}>
      <SubmitButton className="h-12 shadow-[0_0_40px_-8px] shadow-primary/60">
        <Sparkles /> {children ?? "Try the demo"}
      </SubmitButton>
      <FormError state={state} />
    </form>
  );
}

export function GoogleButton() {
  return (
    <form action={googleSignInAction}>
      <Button type="submit" variant="outline" size="lg" className="h-11 w-full rounded-xl">
        <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
          <path
            fill="#EA4335"
            d="M12 10.2v3.9h5.4c-.2 1.3-1.6 3.9-5.4 3.9-3.3 0-5.9-2.7-5.9-6s2.7-6 5.9-6c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.4 14.6 2.4 12 2.4 6.7 2.4 2.4 6.7 2.4 12s4.3 9.6 9.6 9.6c5.5 0 9.2-3.9 9.2-9.4 0-.6-.1-1.1-.2-1.6H12z"
          />
        </svg>
        Continue with Google
      </Button>
    </form>
  );
}
