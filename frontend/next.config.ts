import type { NextConfig } from "next";
import path from "path";

const basePath = (process.env.NEXT_PUBLIC_BASE_PATH || "").replace(/\/$/, "");

const nextConfig: NextConfig = {
  ...(basePath ? { basePath, assetPrefix: basePath } : {}),
  // 限定为 frontend 目录，避免指到 monorepo 根目录导致后端 .py 改动触发前端重启
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
