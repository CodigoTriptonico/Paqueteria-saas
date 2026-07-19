import { Suspense } from "react";
import { LoginForm } from "@/app/login/login-form";
import { isPublicSignupEnabled } from "@/lib/auth/public-signup";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm allowSignup={isPublicSignupEnabled()} />
    </Suspense>
  );
}
