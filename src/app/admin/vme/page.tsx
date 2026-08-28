import { createClient } from "@/lib/supabase/server";
import { datum } from "@/lib/format";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Vme } from "@/lib/types";
import { CreateVmeForm, EditVmeDialog } from "./vme-forms";

export const metadata = { title: "VME's" };

export default async function VmePage() {
  const supabase = await createClient();
  const { data: vmes } = await supabase
    .from("vme")
    .select("*")
    .order("naam")
    .returns<Vme[]>();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Nieuwe VME</CardTitle>
          <CardDescription>
            Het datamodel ondersteunt meerdere VME&apos;s per syndicus.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CreateVmeForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>VME&apos;s ({vmes?.length ?? 0})</CardTitle>
        </CardHeader>
        <CardContent>
          {!vmes || vmes.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nog geen VME&apos;s.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Naam</TableHead>
                  <TableHead>Adres</TableHead>
                  <TableHead>IBAN</TableHead>
                  <TableHead>Aangemaakt</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {vmes.map((v) => (
                  <TableRow key={v.id}>
                    <TableCell className="font-medium">{v.naam}</TableCell>
                    <TableCell>{v.adres ?? "—"}</TableCell>
                    <TableCell>{v.iban ?? "—"}</TableCell>
                    <TableCell>{datum(v.created_at)}</TableCell>
                    <TableCell className="text-right">
                      <EditVmeDialog vme={v} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
