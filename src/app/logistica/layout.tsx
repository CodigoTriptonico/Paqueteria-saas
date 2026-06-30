import { requirePathAccess } from "@/lib/auth/require";

export default async function LogisticaLayout({ children }: { children: React.ReactNode }) {
  await requirePathAccess("/logistica");
  return children;
}
