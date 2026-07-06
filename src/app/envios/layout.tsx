import { Suspense } from "react";
import { requirePathAccess } from "@/lib/auth/require";

export default async function EnviosLayout({ children }: { children: React.ReactNode }) {
  await requirePathAccess("/envios");
  return <Suspense fallback={null}>{children}</Suspense>;
}
