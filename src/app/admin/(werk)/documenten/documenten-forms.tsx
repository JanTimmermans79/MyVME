"use client";

import { useState } from "react";
import { Upload } from "lucide-react";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/form";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { uploadDocumenten, deleteDocument } from "./actions";

const CATEGORIEEN = ["notulen", "contract", "factuur", "verzekering", "overig"];

export function UploadDocumentenDialog({
  vmeId,
  boekjaarId,
  boekjaarLabel,
}: {
  vmeId: string;
  boekjaarId: string | null;
  boekjaarLabel: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Upload className="size-3.5" /> Documenten uploaden
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Documenten uploaden</DialogTitle>
        </DialogHeader>
        <ActionForm
          action={uploadDocumenten}
          hiddenFields={{ vme_id: vmeId }}
          onSuccess={() => setOpen(false)}
          className="space-y-3"
        >
          <div className="space-y-1.5">
            <Label htmlFor="bestanden">Bestanden</Label>
            <Input
              id="bestanden"
              name="bestanden"
              type="file"
              multiple
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="categorie">Categorie</Label>
            <select
              id="categorie"
              name="categorie"
              defaultValue="overig"
              className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
            >
              {CATEGORIEEN.map((c) => (
                <option key={c} value={c} className="capitalize">
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="boekjaar_id">Koppelen aan</Label>
            <select
              id="boekjaar_id"
              name="boekjaar_id"
              defaultValue={boekjaarId ?? ""}
              className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
            >
              {boekjaarId && <option value={boekjaarId}>{boekjaarLabel}</option>}
              <option value="">Algemeen (hele VME)</option>
            </select>
          </div>
          <DialogFooter>
            <SubmitButton>Uploaden</SubmitButton>
          </DialogFooter>
        </ActionForm>
      </DialogContent>
    </Dialog>
  );
}

export function DeleteDocumentButton({ id }: { id: string }) {
  return (
    <ActionForm action={deleteDocument} hiddenFields={{ id }}>
      <ConfirmSubmit
        size="sm"
        variant="ghost"
        message="Document verwijderen?"
      >
        Verwijderen
      </ConfirmSubmit>
    </ActionForm>
  );
}
