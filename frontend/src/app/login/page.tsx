import { Suspense } from "react";
import LoginForm from "./LoginForm";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background text-on-surface-variant">
          加载中…
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
