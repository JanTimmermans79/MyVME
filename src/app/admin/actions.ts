"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { ACTIVE_VME_COOKIE } from "@/lib/vme-context";

export async function setActiveVme(formData: FormData) {
  await requireAdmin();
  const vmeId = String(formData.get("vme_id") ?? "");
  if (vmeId) {
    const cookieStore = await cookies();
    cookieStore.set(ACTIVE_VME_COOKIE, vmeId, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
    });
  }
  revalidatePath("/admin", "layout");
}
