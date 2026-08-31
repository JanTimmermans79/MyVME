import { OpbrengstenView } from "../../opbrengsten-view";
export const metadata = { title: "Opbrengsten zichtrekening" };
export default function Page() {
  return <OpbrengstenView rekening="zicht" />;
}
