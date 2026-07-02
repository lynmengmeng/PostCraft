# PostCraft SEO 落地页部署指南

本文档说明 PostCraft 公开引流页（`/`）上线前的配置与 SEO 提交事项。

## 页面与路由

| 路由 | 用途 | 是否纳入 SEO |
| --- | --- | --- |
| `/` | 公开 SEO 落地页 | 是（主入口） |
| `/workspace` | 创作工作台 | 可选（已在 sitemap 中） |
| `/create/*` | 创作工作室 | 否（`robots.txt` 已屏蔽） |

落地页源码：`frontend/src/components/marketing/LandingPage.tsx`  
站点配置：`frontend/src/lib/site.ts`

## 部署前必做

### 1. 配置正式站点 URL

在 `frontend/.env.local`（或部署平台的环境变量）中设置：

```env
NEXT_PUBLIC_SITE_URL=https://你的域名.com
```

该变量用于：

- `metadataBase` 与 canonical 链接
- Open Graph / Twitter Card 中的绝对 URL
- `sitemap.xml` 与 `robots.txt` 中的站点地址

未配置时，默认回退为 `https://postcraft.app`，**上线前务必改为真实域名**。

本地开发可参考 `frontend/.env.local.example`：

```env
NEXT_PUBLIC_API_URL=http://localhost:8082/api
NEXT_PUBLIC_SITE_URL=http://localhost:3002
```

### 2. 配置后端 API 地址

生产环境需同时设置后端 CORS 与前端 API 地址：

**前端** `frontend/.env.local`：

```env
NEXT_PUBLIC_API_URL=https://api.你的域名.com/api
```

**后端** 根目录 `.env`：

```env
CORS_ORIGINS=https://你的域名.com,https://www.你的域名.com
```

### 3. 构建与验证

```powershell
cd frontend
npm run build
npm run start
```

上线前建议本地或预发环境检查：

- [ ] 访问 `/` 落地页正常渲染
- [ ] 访问 `/sitemap.xml` 中 URL 均为正式域名
- [ ] 访问 `/robots.txt` 中 `Sitemap:` 指向正式域名
- [ ] 页面 `<head>` 中 `canonical`、`og:url` 为正式域名
- [ ] 「免费开始创作」等 CTA 跳转至 `/workspace` 正常

## 搜索引擎提交

站点已内置：

- **`/sitemap.xml`**：由 `frontend/src/app/sitemap.ts` 生成
- **`/robots.txt`**：由 `frontend/src/app/robots.ts` 生成（允许 `/`，屏蔽 `/create/`、`/api/`）
- **结构化数据（JSON-LD）**：`SoftwareApplication`、`FAQPage`、`WebSite`（见落地页组件）

上线后建议：

1. **Google Search Console**  
   - 添加站点资源  
   - 提交 Sitemap：`https://你的域名.com/sitemap.xml`

2. **百度站长平台**（若面向国内搜索）  
   - 验证站点所有权  
   - 提交同上 sitemap 地址

3. **Bing Webmaster Tools**（可选）  
   - 同步提交 sitemap

提交后通常需数天至数周才会看到索引变化，可在站长工具中查看抓取与索引状态。

## 可选优化

### Open Graph 分享图

当前 metadata 未配置 `openGraph.images`。若需要在微信、Twitter、Slack 等分享时展示封面图，可在 `frontend/src/app/page.tsx` 的 `metadata.openGraph` 中增加：

```typescript
openGraph: {
  // ...现有配置
  images: [
    {
      url: "/og-image.png", // 建议 1200×630，放在 frontend/public/
      width: 1200,
      height: 630,
      alt: "PostCraft 生活有稿",
    },
  ],
},
```

将图片放入 `frontend/public/og-image.png` 后重新构建部署。

### 修改 SEO 文案

集中修改 `frontend/src/lib/site.ts` 中的：

- `description` — 搜索结果摘要
- `keywords` — 关键词数组
- `tagline` — 副标题 / Slogan

落地页正文（功能介绍、FAQ 等）在 `LandingPage.tsx` 中维护；FAQ 同时参与 JSON-LD，修改后无需额外配置。

### 分析统计（可选）

如需统计落地页引流效果，可在 `frontend/src/app/layout.tsx` 或落地页中接入：

- Google Analytics / Google Tag Manager
- 百度统计
- Plausible、Umami 等隐私友好方案

建议仅对公开页（`/`）或全站统一接入，并注意隐私合规说明。

## 相关文件一览

| 文件 | 说明 |
| --- | --- |
| `frontend/src/app/page.tsx` | 首页 metadata（title、OG、robots 等） |
| `frontend/src/app/sitemap.ts` | 站点地图 |
| `frontend/src/app/robots.ts` | 爬虫规则 |
| `frontend/src/lib/site.ts` | 站点 URL 与 SEO 基础文案 |
| `frontend/src/components/marketing/LandingPage.tsx` | 落地页 UI 与 JSON-LD |
| `frontend/.env.local.example` | 环境变量示例 |

## 常见问题

**Q：为什么工作台从 `/` 改到了 `/workspace`？**  
A：根路径 `/` 留给公开 SEO 落地页，便于搜索引擎与用户首次访问时看到产品介绍；已登录/使用产品通过 CTA 进入 `/workspace`。

**Q：创作页为什么不让搜索引擎索引？**  
A：`/create/[projectId]` 为个人草稿与创作过程，无公开价值且涉及隐私，已在 `robots.txt` 中 `disallow`。

**Q：修改 `NEXT_PUBLIC_SITE_URL` 后需要重新构建吗？**  
A：需要。Next.js 在构建时将 `NEXT_PUBLIC_*` 变量打入静态资源，改域名后请重新 `npm run build` 并部署。
