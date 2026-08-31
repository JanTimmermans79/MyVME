import { KostenView } from "../../kosten-view";
export const metadata = { title: "Kosten spaarrekening" };
export default function Page() {
  return <KostenView rekening="spaar" />;
}
