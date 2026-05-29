import { requirePlatformPathAccess } from "@/lib/auth/require";

export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  await requirePlatformPathAccess();
  return children;
}
