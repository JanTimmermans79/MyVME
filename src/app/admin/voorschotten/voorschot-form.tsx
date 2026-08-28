"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";
import { useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { IDLE, type ActionState } from "@/lib/action-state";
import { setVoorschotEigenaar, setVoorschotHuurder } from "./actions";

function SaveBtn() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" variant="outline" disabled={pending}>
      {pending ? "…" : "Opslaan"}
    </Button>
  );
}

function Rij({
  action,
  idField,
  idValue,
  boekjaarId,
  huidig,
}: {
  action: (p: ActionState, f: FormData) => Promise<ActionState>;
  idField: string;
  idValue: string;
  boekjaarId: string;
  huidig: number | null;
}) {
  const [state, formAction] = useActionState(action, IDLE);
  const done = useRef<ActionState | null>(null);

  useEffect(() => {
    if (state === done.current) return;
    if (state.ok && state.message) {
      done.current = state;
      toast.success(state.message);
    }
    if (state.error) toast.error(state.error);
  }, [state]);

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name={idField} value={idValue} />
      <input type="hidden" name="boekjaar_id" value={boekjaarId} />
      <Input
        name="bedrag_per_maand"
        inputMode="decimal"
        defaultValue={huidig ?? ""}
        placeholder="—"
        className="h-8 w-28"
      />
      <span className="text-xs text-muted-foreground">/maand</span>
      <SaveBtn />
    </form>
  );
}

export function VoorschotEigenaarRij(props: {
  unitId: string;
  boekjaarId: string;
  huidig: number | null;
}) {
  return (
    <Rij
      action={setVoorschotEigenaar}
      idField="unit_id"
      idValue={props.unitId}
      boekjaarId={props.boekjaarId}
      huidig={props.huidig}
    />
  );
}

export function VoorschotHuurderRij(props: {
  huurderId: string;
  boekjaarId: string;
  huidig: number | null;
}) {
  return (
    <Rij
      action={setVoorschotHuurder}
      idField="huurder_id"
      idValue={props.huurderId}
      boekjaarId={props.boekjaarId}
      huidig={props.huidig}
    />
  );
}
