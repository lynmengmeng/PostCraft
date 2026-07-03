"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { Icon } from "@/components/ui/Icon";

export default function RegisterPage() {
  const router = useRouter();
  const { register, config, loading } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && config && !config.allow_register) {
      router.replace("/login");
    }
  }, [config, loading, router]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (password !== confirm) {
      setError("两次输入的密码不一致");
      return;
    }
    setSubmitting(true);
    try {
      await register(username.trim(), password);
      router.replace("/workspace");
    } catch (err) {
      setError(err instanceof Error ? err.message : "注册失败");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || (config && !config.allow_register)) {
    return null;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-2xl border border-outline-variant/30 bg-surface p-8 shadow-sm">
        <div className="mb-8 text-center">
          <Link href="/" className="font-headline text-2xl font-bold text-primary">
            PostCraft
          </Link>
          <p className="mt-2 text-sm text-on-surface-variant">创建账号，开始内容创作</p>
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
              placeholder="至少 3 个字符"
            />
          </div>

          <div>
            <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-on-surface">
              密码
            </label>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-outline-variant/40 bg-surface-container-low px-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
              placeholder="至少 6 个字符"
            />
          </div>

          <div>
            <label htmlFor="confirm" className="mb-1.5 block text-sm font-medium text-on-surface">
              确认密码
            </label>
            <input
              id="confirm"
              type="password"
              autoComplete="new-password"
              required
              minLength={6}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full rounded-xl border border-outline-variant/40 bg-surface-container-low px-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
              placeholder="再次输入密码"
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
            <Icon name="person_add" className="text-[18px]" />
            {submitting ? "注册中…" : "注册"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-on-surface-variant">
          已有账号？{" "}
          <Link href="/login" className="font-medium text-primary hover:underline">
            登录
          </Link>
        </p>
      </div>
    </div>
  );
}
