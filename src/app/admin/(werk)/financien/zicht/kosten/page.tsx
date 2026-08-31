import { KostenView } from "../../kosten-view";
export const metadata = { title: "Kosten zichtrekening" };
export default function Page() {
  return <KostenView rekening="zicht" />;
}
