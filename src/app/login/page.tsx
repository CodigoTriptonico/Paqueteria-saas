import { redirect } from "next/navigation";
import { Suspense } from "react";
import { LoginForm } from "@/app/login/login-form";
import { getAppSession } from "@/lib/auth/session";
import { isPublicSignupEnabled } from "@/lib/auth/public-signup";
import { resolvePostLoginRedirect } from "@/lib/organizations/kind";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const session = await getAppSession();

  if (session) {
    const { next } = await searchParams;
    redirect(
      resolvePostLoginRedirect({
        isPlatformAdmin: session.isPlatformAdmin,
        nextPath: next ?? null,
      }),
    );
  }

  return (
    <Suspense fallback={null}>
      <LoginForm allowSignup={isPublicSignupEnabled()} />
    </Suspense>
  );
}
