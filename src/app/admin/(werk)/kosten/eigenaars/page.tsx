import { KostenView } from "../../financien/kosten-view";

export const metadata = { title: "Onkosten eigenaars" };

export default function Page() {
  return <KostenView groep="eigenaars" />;
}
