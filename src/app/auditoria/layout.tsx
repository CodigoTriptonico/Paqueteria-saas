import { Suspense } from "react";
import { requirePathAccess } from "@/lib/auth/require";

export default async function AuditoriaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requirePathAccess("/auditoria");
  return <Suspense fallback={null}>{children}</Suspense>;
}
