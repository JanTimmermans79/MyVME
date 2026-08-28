import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";

export default async function Home() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.profile?.is_admin) redirect("/admin");
  redirect("/dashboard");
}
