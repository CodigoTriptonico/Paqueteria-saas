import { requirePathAccess } from "@/lib/auth/require";

export default async function ConfiguracionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requirePathAccess("/configuracion");
  return children;
}
