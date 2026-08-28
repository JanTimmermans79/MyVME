"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { ActionState } from "@/lib/action-state";

export function SubmitButton({
  children = "Opslaan",
  className,
  variant,
  size,
}: {
  children?: React.ReactNode;
  className?: string;
  variant?: React.ComponentProps<typeof Button>["variant"];
  size?: React.ComponentProps<typeof Button>["size"];
}) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      disabled={pending}
      className={className}
      variant={variant}
      size={size}
    >
      {pending ? "Bezig…" : children}
    </Button>
  );
}

export function FormMessage({ state }: { state: ActionState }) {
  if (state.error) {
    return <p className="text-sm text-destructive">{state.error}</p>;
  }
  if (state.ok && state.message) {
    return <p className="text-sm text-emerald-600">{state.message}</p>;
  }
  return null;
}

export function Field({
  label,
  name,
  className,
  hint,
  ...props
}: React.ComponentProps<typeof Input> & { label: string; hint?: string }) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} {...props} />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
