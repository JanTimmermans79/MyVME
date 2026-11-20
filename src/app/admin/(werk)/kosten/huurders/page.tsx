import { KostenView } from "../../financien/kosten-view";

export const metadata = { title: "Onkosten huurders" };

export default function Page() {
  return <KostenView groep="huurders" />;
}
