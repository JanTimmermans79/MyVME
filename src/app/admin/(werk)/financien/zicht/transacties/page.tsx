import { RekeningTransacties } from "../../transacties/rekening-transacties";

export const metadata = { title: "Transacties zichtrekening" };

export default function Page() {
  return <RekeningTransacties rekening="zicht" />;
}
