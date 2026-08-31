import { OpbrengstenView } from "../../opbrengsten-view";
export const metadata = { title: "Opbrengsten spaarrekening" };
export default function Page() {
  return <OpbrengstenView rekening="spaar" />;
}
