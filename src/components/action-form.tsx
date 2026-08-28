"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FormMessage } from "@/components/form";
import { IDLE, type ActionState } from "@/lib/action-helpers";

type Action = (
  prev: ActionState,
  formData: FormData,
) => Promise<ActionState>;

/**
 * Form gekoppeld aan een server action via useActionState.
 * Toont fout/succes-bericht, toont een toast bij succes en reset optioneel.
 */
export function ActionForm({
  action,
  children,
  className,
  resetOnSuccess = false,
  onSuccess,
  redirectOnSuccess,
  hiddenFields,
}: {
  action: Action;
  children: React.ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
  onSuccess?: () => void;
  redirectOnSuccess?: string;
  hiddenFields?: Record<string, string>;
}) {
  const [state, formAction] = useActionState(action, IDLE);
  const formRef = useRef<HTMLFormElement>(null);
  const lastHandled = useRef<ActionState | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (state === lastHandled.current) return;
    if (state.ok) {
      lastHandled.current = state;
      if (state.message) toast.success(state.message);
      if (resetOnSuccess) formRef.current?.reset();
      onSuccess?.();
      if (redirectOnSuccess) router.push(redirectOnSuccess);
    }
  }, [state, resetOnSuccess, onSuccess, redirectOnSuccess, router]);

  return (
    <form ref={formRef} action={formAction} className={className}>
      {hiddenFields &&
        Object.entries(hiddenFields).map(([k, v]) => (
          <input key={k} type="hidden" name={k} value={v} />
        ))}
      {children}
      <FormMessage state={state} />
    </form>
  );
}
