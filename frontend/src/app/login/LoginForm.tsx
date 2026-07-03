"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { Icon } from "@/components/ui/Icon";

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, config } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const redirect = searchParams.get("redirect") || "/workspace";
  const allowRegister = config?.allow_register ?? true;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await login(username.trim(), password);
      router.replace(redirect);
    } catch (err) {
      setError(err instanceof Error ? err.message : "登录失败");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-2xl border border-outline-variant/30 bg-surface p-8 shadow-sm">
        <div className="mb-8 text-center">
          <Link href="/" className="font-headline text-2xl font-bold text-primary">
            PostCraft
          </Link>
          <p className="mt-2 text-sm text-on-surface-variant">登录以访问你的创作工作台</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="username" className="mb-1.5 block text-sm font-medium text-on-surface">
              用户名
            </label>
            <input
              id="username"
              type="text"
              autoComplete="username"
              required
              minLength={3}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded-xl border border-outline-variant/40 bg-surface-container-low px-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
              placeholder="请输入用户名"
            />
          </div>

          <div>
            <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-on-surface">
              密码
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-outline-variant/40 bg-surface-container-low px-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
              placeholder="请输入密码"
            />
          </div>

          {error && (
            <p className="rounded-lg bg-error-container px-3 py-2 text-sm text-error">{error}</p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-on-primary transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            <Icon name="login" className="text-[18px]" />
            {submitting ? "登录中…" : "登录"}
          </button>
        </form>

        {allowRegister && (
          <p className="mt-6 text-center text-sm text-on-surface-variant">
            还没有账号？{" "}
            <Link href="/register" className="font-medium text-primary hover:underline">
              注册
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
