import { Suspense } from "react";
import { LoginForm } from "@/app/login/login-form";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
