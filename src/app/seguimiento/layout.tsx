import { Suspense } from "react";
import { requirePathAccess } from "@/lib/auth/require";

export default async function SeguimientoLayout({ children }: { children: React.ReactNode }) {
  await requirePathAccess("/seguimiento");
  return <Suspense fallback={null}>{children}</Suspense>;
}
