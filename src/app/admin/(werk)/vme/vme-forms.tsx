"use client";

import type { Vme } from "@/lib/types";
import { VME_GEGEVEN_VELDEN } from "@/lib/types";
import { ActionForm } from "@/components/action-form";
import { Field, SubmitButton } from "@/components/form";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { createVme, updateVme, deleteVme } from "./actions";

/** Optionele KBO-/juridische gegevens — inklapbaar zodat het formulier rustig blijft. */
function VmeGegevensVelden({ vme }: { vme?: Vme }) {
  return (
    <details className="sm:col-span-2 rounded-md border p-3">
      <summary className="cursor-pointer text-sm font-medium">
        VME-gegevens (KBO / juridisch) — optioneel
      </summary>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {VME_GEGEVEN_VELDEN.map((v) => (
          <Field
            key={v.key}
            label={v.label}
            name={v.key}
            type={v.type === "date" ? "date" : undefined}
            defaultValue={(vme?.[v.key] as string | null) ?? ""}
          />
        ))}
      </div>
    </details>
  );
}

export function CreateVmeForm() {
  return (
    <ActionForm
      action={createVme}
      resetOnSuccess
      className="grid gap-3 sm:grid-cols-2"
    >
      <Field label="Naam" name="naam" required />
      <Field
        label="Aantal appartementen"
        name="aantal_kavels"
        type="number"
        min={0}
        inputMode="numeric"
      />
      <Field
        label="Zichtrekening (IBAN)"
        name="iban"
        placeholder="BE.."
        hint="Werkingsrekening: hierop betalen eigenaars en huurders hun voorschotten."
      />
      <Field
        label="Spaarrekening / reservefonds (IBAN)"
        name="iban_reserve"
        placeholder="BE.."
        hint="Reservefonds van de VME."
      />
      <Field label="Adres" name="adres" className="sm:col-span-2" />
      <VmeGegevensVelden />
      <div className="sm:col-span-2">
        <SubmitButton>VME toevoegen</SubmitButton>
      </div>
    </ActionForm>
  );
}

const KBO_ALGEMEEN = ["ondernemingsnummer", "kbo_status", "rechtstoestand", "begindatum", "type_entiteit", "rechtsvorm"];
const KBO_NAAM = ["officiele_naam", "afkorting", "zetel_adres"];
const KBO_CONTACT = ["telefoon", "email", "webadres"];
const KBO_SYNDICUS = ["syndicus_naam", "syndicus_sinds"];

function Blok({ titel, children }: { titel: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 rounded-lg border p-4">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {titel}
      </h3>
      <div className="grid gap-3 sm:grid-cols-2">{children}</div>
    </section>
  );
}

/** Alle gegevens van de gekozen VME in één formulier, rechtstreeks aanpasbaar. */
export function VmeGegevensForm({ vme }: { vme: Vme }) {
  const kbo = (keys: string[]) =>
    VME_GEGEVEN_VELDEN.filter((v) => keys.includes(v.key)).map((v) => (
      <Field
        key={v.key}
        label={v.label}
        name={v.key}
        type={v.type === "date" ? "date" : undefined}
        defaultValue={(vme[v.key] as string | null) ?? ""}
      />
    ));
  return (
    <ActionForm
      action={updateVme}
      hiddenFields={{ id: vme.id }}
      className="space-y-4"
    >
      <Blok titel="Algemeen">
        <Field label="Naam" name="naam" required defaultValue={vme.naam} />
        <Field
          label="Aantal appartementen"
          name="aantal_kavels"
          type="number"
          min={0}
          defaultValue={vme.aantal_kavels ?? ""}
        />
        {kbo(KBO_ALGEMEEN)}
      </Blok>
      <Blok titel="Naam & zetel">
        {kbo(KBO_NAAM)}
        <Field label="Adres (werking)" name="adres" defaultValue={vme.adres ?? ""} />
      </Blok>
      <Blok titel="Contact">{kbo(KBO_CONTACT)}</Blok>
      <Blok titel="Syndicus & bankrekeningen">
        {kbo(KBO_SYNDICUS)}
        <Field
          label="Zichtrekening (IBAN)"
          name="iban"
          defaultValue={vme.iban ?? ""}
          hint="Werkingsrekening: voorschotten van eigenaars en huurders."
        />
        <Field
          label="Spaarrekening / reservefonds (IBAN)"
          name="iban_reserve"
          defaultValue={vme.iban_reserve ?? ""}
        />
      </Blok>
      <SubmitButton>Opslaan</SubmitButton>
    </ActionForm>
  );
}

export function VerwijderVmeKnop({ vme }: { vme: Vme }) {
  return (
    <ActionForm action={deleteVme} hiddenFields={{ id: vme.id }}>
      <ConfirmSubmit message={`VME "${vme.naam}" verwijderen?`} />
    </ActionForm>
  );
}
