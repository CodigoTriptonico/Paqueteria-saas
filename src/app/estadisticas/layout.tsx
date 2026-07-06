import { Suspense } from "react";
import { requirePathAccess } from "@/lib/auth/require";

export default async function EstadisticasLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requirePathAccess("/estadisticas");
  return <Suspense fallback={null}>{children}</Suspense>;
}
