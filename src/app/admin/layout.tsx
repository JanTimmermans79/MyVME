import { requireAdmin } from "@/lib/auth";

/**
 * De /admin-boom heeft twee shells:
 *   (kies) -> de VME-kiezer, minimale shell zonder navigatie
 *   (werk) -> alle werk- en configuratieschermen, volledige shell
 * Deze layout doet enkel de toegangscontrole.
 */
export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  await requireAdmin();
  return <>{children}</>;
}
