import { Suspense } from "react";
import { requirePathAccess } from "@/lib/auth/require";

export default async function LogisticaLayout({ children }: { children: React.ReactNode }) {
  await requirePathAccess("/logistica");
  return <Suspense fallback={null}>{children}</Suspense>;
}
