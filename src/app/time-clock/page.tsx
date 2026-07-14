import { redirect } from "next/navigation";
import { requirePathAccess } from "@/lib/auth/require";

export default async function TimeClockPage() {
  await requirePathAccess("/time-clock");
  redirect("/configuracion?view=timeclock");
}
