import { Suspense } from "react";
import { requirePathAccess } from "@/lib/auth/require";

export default async function ConductorLayout({ children }: { children: React.ReactNode }) {
  await requirePathAccess("/conductor/tareas");
  return <Suspense fallback={null}>{children}</Suspense>;
}
