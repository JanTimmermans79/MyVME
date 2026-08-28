"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";

/** Submit-knop met bevestigingsvraag; voor onomkeerbare acties (verwijderen). */
export function ConfirmSubmit({
  children = "Verwijderen",
  message = "Weet je het zeker? Dit kan niet ongedaan gemaakt worden.",
  variant = "destructive",
  size = "sm",
}: {
  children?: React.ReactNode;
  message?: string;
  variant?: React.ComponentProps<typeof Button>["variant"];
  size?: React.ComponentProps<typeof Button>["size"];
}) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant={variant}
      size={size}
      disabled={pending}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    >
      {pending ? "Bezig…" : children}
    </Button>
  );
}
