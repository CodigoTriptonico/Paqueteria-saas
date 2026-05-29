import { requirePathAccess } from "@/lib/auth/require";

export default async function VentaLayout({ children }: { children: React.ReactNode }) {
  await requirePathAccess("/venta");
  return children;
}
