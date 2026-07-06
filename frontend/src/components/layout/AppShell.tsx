"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { BackendStatusBanner } from "@/components/layout/BackendStatusBanner";
import { Icon } from "@/components/ui/Icon";

const navItems = [
  { href: "/workspace", label: "工作台", icon: "dashboard" },
  { href: "/inspirations", label: "灵感库", icon: "lightbulb" },
  { href: "/topics", label: "选题库", icon: "topic" },
  { href: "/tools", label: "热点工具", icon: "trending_up" },
  { href: "/drafts", label: "草稿箱", icon: "description" },
  { href: "/settings", label: "设置", icon: "settings" },
];

const searchPlaceholders: Record<string, string> = {
  "/workspace": "搜索工作台...",
  "/inspirations": "搜索灵感库...",
  "/topics": "搜索选题、支柱或基调...",
  "/tools": "搜索热点话题...",
  "/drafts": "搜索草稿...",
  "/settings": "搜索设置...",
};

interface ShellContextValue {
  zenMode: boolean;
  setZenMode: (v: boolean) => void;
  searchQuery: string;
  setSearchQuery: (v: string) => void;
}

const ShellContext = createContext<ShellContextValue>({
  zenMode: false,
  setZenMode: () => {},
  searchQuery: "",
  setSearchQuery: () => {},
});

export function useShell() {
  return useContext(ShellContext);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, config, loading, logout } = useAuth();
  const isAuthPage = pathname === "/login" || pathname === "/register";
  const isSeoLanding = pathname === "/";
  const isCreatePage = pathname.startsWith("/create/");
  // 仅在后端明确关闭鉴权时，创作页才可匿名访问；config 未加载时不放行
  const isPublicCreate = isCreatePage && config?.auth_required === false;
  const isPublicPage = isSeoLanding || isAuthPage || isPublicCreate;
  const [zenMode, setZenMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const searchPlaceholder = useMemo(() => {
    const match = Object.entries(searchPlaceholders).find(([path]) =>
      path === "/" ? pathname === "/" : pathname.startsWith(path),
    );
    return match?.[1] ?? "搜索...";
  }, [pathname]);

  useEffect(() => {
    setSearchQuery("");
  }, [pathname]);

  useEffect(() => {
    if (loading || isPublicPage || isAuthPage) return;
    if (config?.auth_required && !user) {
      const redirect = encodeURIComponent(pathname);
      router.replace(`/login?redirect=${redirect}`);
    }
  }, [loading, config, user, isPublicPage, isAuthPage, pathname, router]);

  if (isPublicPage || isAuthPage) {
    return <>{children}</>;
  }

  if (loading || (config?.auth_required && !user)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-on-surface-variant">
        加载中…
      </div>
    );
  }

  const showInspector = pathname === "/workspace";

  return (
    <ShellContext.Provider value={{ zenMode, setZenMode, searchQuery, setSearchQuery }}>
      <div className={`bg-background ${isCreatePage ? "h-screen overflow-hidden" : "min-h-screen"}`}>
        {/* SideNav */}
        <aside
          className={`fixed left-0 top-0 bottom-0 z-50 flex h-screen w-sidebar flex-col border-r border-outline-variant/30 bg-surface transition-transform duration-500 ${
            zenMode ? "-translate-x-full" : "translate-x-0"
          }`}
        >
          <div className="p-6">
            <Link href="/workspace" className="font-headline text-xl font-bold text-primary">
              PostCraft
            </Link>
            <p className="mt-0.5 text-[13px] font-semibold tracking-wide text-on-surface-variant/70">
              Studio Edition
            </p>
          </div>

          <nav className="flex-1 space-y-1 px-3">
            {navItems.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 rounded-r-lg px-4 py-3 text-[15px] transition-all duration-200 ${
                    active
                      ? "border-l-4 border-primary bg-surface-container font-bold text-primary"
                      : "text-on-surface-variant hover:bg-surface-container-low"
                  }`}
                >
                  <Icon name={item.icon} className="text-[20px]" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="border-t border-outline-variant/30 p-4">
            {user && (
              <div className="mb-3 flex items-center justify-between rounded-lg bg-surface-container-low px-3 py-2">
                <div className="flex min-w-0 items-center gap-2">
                  <Icon name="account_circle" className="shrink-0 text-[20px] text-primary" />
                  <span className="truncate text-[13px] font-medium text-on-surface">
                    {user.username}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    logout();
                    router.push("/login");
                  }}
                  className="shrink-0 rounded-md p-1 text-on-surface-variant transition-colors hover:bg-surface-container hover:text-error"
                  title="退出登录"
                >
                  <Icon name="logout" className="text-[18px]" />
                </button>
              </div>
            )}
            <button
              type="button"
              onClick={() => router.push("/workspace")}
              className="mb-4 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-[13px] font-semibold tracking-wide text-on-primary transition-opacity hover:opacity-90"
            >
              <Icon name="add" className="text-[18px]" />
              新建观察
            </button>
            <Link
              href="/settings"
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-on-surface-variant transition-colors hover:bg-surface-container-low"
            >
              <Icon name="settings" className="text-[20px]" />
              <span className="text-[13px] font-semibold">设置</span>
            </Link>
            <Link
              href="/drafts"
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-on-surface-variant transition-colors hover:bg-surface-container-low"
            >
              <Icon name="archive" className="text-[20px]" />
              <span className="text-[13px] font-semibold">归档</span>
            </Link>
          </div>
        </aside>

        {/* TopBar */}
        <header
          className={`fixed top-0 right-0 z-40 flex h-16 items-center justify-between border-b border-outline-variant/30 bg-surface/80 px-gutter backdrop-blur-md transition-transform duration-500 ${
            zenMode ? "-translate-y-full" : "translate-y-0"
          }`}
          style={{ left: zenMode ? 0 : "var(--sidebar-width)" }}
        >
          <div className="flex flex-1 items-center gap-4">
            <div className="relative w-full max-w-lg">
              <Icon
                name="search"
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[20px] text-on-surface-variant"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full rounded-full border border-outline-variant/30 bg-surface-container-low py-2.5 pl-10 pr-4 text-sm outline-none transition-all placeholder:text-on-surface-variant/50 focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="rounded-full p-2.5 text-on-surface-variant transition-colors hover:bg-surface-container-low"
              title="通知"
            >
              <Icon name="notifications" className="text-[20px]" />
            </button>
            <button
              type="button"
              onClick={() => router.push("/settings")}
              className="rounded-full p-2.5 text-on-surface-variant transition-colors hover:bg-surface-container-low"
              title="设置"
            >
              <Icon name="settings" className="text-[20px]" />
            </button>
            <BackendStatusBanner compact />
            <button
              type="button"
              onClick={() => router.push("/workspace")}
              className="rounded-xl bg-primary px-5 py-2 text-sm font-bold text-on-primary transition-opacity hover:opacity-90"
            >
              开始创作
            </button>
          </div>
        </header>

        {/* Main */}
        <main
          className={`transition-[margin] duration-500 ${
            zenMode ? "ml-0" : "ml-sidebar"
          } ${
            isCreatePage
              ? "flex h-screen flex-col overflow-hidden pt-16"
              : "min-h-screen pt-16"
          }`}
        >
          {children}
        </main>
      </div>
    </ShellContext.Provider>
  );
}
