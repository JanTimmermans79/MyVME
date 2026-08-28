"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { clientEnv } from "@/lib/env";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function LoginForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/";
  const hadError = searchParams.get("error");

  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle",
  );
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setMessage(null);

    const supabase = createClient();
    const redirectTo = `${clientEnv.siteUrl}/auth/callback?next=${encodeURIComponent(next)}`;

    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: redirectTo },
    });

    if (error) {
      setStatus("error");
      setMessage(error.message);
    } else {
      setStatus("sent");
    }
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>MyVME</CardTitle>
        <CardDescription>
          Beheertool voor de Vereniging van Mede-Eigenaars
        </CardDescription>
      </CardHeader>
      <CardContent>
        {status === "sent" ? (
          <p className="text-sm text-muted-foreground">
            We stuurden een aanmeldlink naar <strong>{email}</strong>. Open die
            link op dit toestel om aan te melden.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {hadError && (
              <p className="text-sm text-destructive">
                Aanmelden mislukte. Probeer opnieuw.
              </p>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">E-mailadres</Label>
              <Input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="jij@voorbeeld.be"
              />
            </div>
            {message && <p className="text-sm text-destructive">{message}</p>}
            <Button
              type="submit"
              className="w-full"
              disabled={status === "sending"}
            >
              {status === "sending" ? "Bezig…" : "Stuur aanmeldlink"}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
