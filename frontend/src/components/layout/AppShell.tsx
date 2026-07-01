"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BackendStatusBanner } from "@/components/layout/BackendStatusBanner";

const navItems = [
  { href: "/", label: "工作台" },
  { href: "/inspirations", label: "灵感库" },
  { href: "/topics", label: "选题库" },
  { href: "/drafts", label: "草稿箱" },
  { href: "/settings", label: "设置" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hideNav = pathname.startsWith("/create/");

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900">
      {!hideNav && <BackendStatusBanner />}
      {!hideNav && (
        <header className="border-b border-stone-200 bg-white/90 backdrop-blur">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
            <div>
              <Link href="/" className="text-lg font-semibold tracking-tight">
                生活有稿
              </Link>
              <p className="text-xs text-stone-500">PostCraft · 个人内容创作工作台</p>
            </div>
            <nav className="flex gap-4 text-sm">
              {navItems.map((item) => {
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={
                      active
                        ? "font-medium text-amber-700"
                        : "text-stone-600 hover:text-stone-900"
                    }
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        </header>
      )}
      <main className={hideNav ? "" : "mx-auto max-w-7xl px-6 py-8"}>{children}</main>
    </div>
  );
}
