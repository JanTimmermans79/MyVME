import { RekeningKop } from "../rekening-kop";

export default function SpaarLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-5">
      <RekeningKop rekening="spaar" />
      {children}
    </div>
  );
}
