import { RekeningKop } from "../rekening-kop";

export default function ZichtLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-5">
      <RekeningKop rekening="zicht" />
      {children}
    </div>
  );
}
