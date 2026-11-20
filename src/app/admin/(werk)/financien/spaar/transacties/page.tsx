import { RekeningTransacties } from "../../transacties/rekening-transacties";

export const metadata = { title: "Transacties spaarrekening" };

export default function Page() {
  return <RekeningTransacties rekening="spaar" />;
}
