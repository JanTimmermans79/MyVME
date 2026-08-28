import { Suspense } from "react";
import { LoginForm } from "./login-form";

export const metadata = { title: "Aanmelden – MyVME" };

export default function LoginPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <Suspense>
        <LoginForm />
      </Suspense>
    </main>
  );
}
