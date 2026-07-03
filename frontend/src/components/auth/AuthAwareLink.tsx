"use client";

import Link from "next/link";
import type { ComponentProps } from "react";
import { useAuth } from "@/components/auth/AuthProvider";

type AuthAwareLinkProps = ComponentProps<typeof Link> & {
  /** 登录成功后跳转目标，默认与 href 相同 */
  redirectTo?: string;
};

export function AuthAwareLink({
  href,
  redirectTo,
  children,
  ...props
}: AuthAwareLinkProps) {
  const { user, config } = useAuth();
  const target = String(href);
  const destination = redirectTo ?? target;
  const needsLogin = config?.auth_required && !user;
  const resolvedHref = needsLogin
    ? `/login?redirect=${encodeURIComponent(destination)}`
    : href;

  return (
    <Link href={resolvedHref} {...props}>
      {children}
    </Link>
  );
}
