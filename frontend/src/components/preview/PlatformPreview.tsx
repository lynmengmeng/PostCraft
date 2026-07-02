import type { ContentProject, Platform } from "@/lib/types";
import { platformLabels } from "@/lib/api";
import { resolveImageUrl } from "@/lib/export";
import { renderXhsBody } from "@/lib/markdown";
import {
  getWechatPlainText,
  normalizeStyleTheme,
  renderWechatBodyInlineHtml,
  renderWechatCopyHtml,
} from "@/lib/wechat-html";

export function WechatPreview({
  content,
  coverAssets = [],
}: {
  content: ContentProject["platforms"]["wechat"];
  coverAssets?: ContentProject["cover_assets"];
}) {
  const theme = normalizeStyleTheme(content.style_theme);
  const accent = theme.accent;
  const summaryStyle = {
    borderLeftColor: "#fbbf24",
    background: "#fffbeb",
  };

  return (
    <div className="wechat-preview mx-auto max-w-[480px] overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
      <div className="border-b border-stone-100 bg-stone-50 px-5 py-3 text-xs tracking-wide text-stone-400">
        公众号预览
        {theme.mood && (
          <span className="ml-2 rounded-full bg-stone-200/80 px-2 py-0.5 text-[10px] text-stone-600">
            {theme.mood}
          </span>
        )}
      </div>
      <div className="px-6 py-6">
        <h1 className="text-[22px] font-bold leading-snug tracking-tight text-stone-900">
          {content.title || "标题待生成"}
        </h1>
        {content.summary && (
          <p
            className="mt-4 rounded-lg border-l-4 px-4 py-3 text-sm leading-relaxed text-stone-600"
            style={summaryStyle}
          >
            {content.summary}
          </p>
        )}
        <div
          className="article-body mt-6 text-[16px] text-stone-800"
          style={{ ["--wechat-accent" as string]: accent }}
          dangerouslySetInnerHTML={{
            __html: renderWechatBodyInlineHtml(
              content.body || "正文待生成",
              theme,
              coverAssets,
              resolveImageUrl,
            ),
          }}
        />
        <p className="mt-6 rounded-lg bg-stone-50 px-3 py-2 text-xs leading-relaxed text-stone-500">
          近似预览效果，以公众号后台为准。请使用顶栏「复制富文本」粘贴到 mp.weixin.qq.com；若图片不显示，请从配图清单下载后手动上传。
        </p>
      </div>
    </div>
  );
}

export function XiaohongshuPreview({
  content,
}: {
  content: ContentProject["platforms"]["xiaohongshu"];
}) {
  const cover = resolveImageUrl(content.cover_image);
  return (
    <div className="xhs-preview mx-auto max-w-[360px] overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-sm">
      <div
        className="relative aspect-[3/4] overflow-hidden bg-gradient-to-br from-rose-50 to-orange-100"
        style={
          cover
            ? {
                backgroundImage: `url(${cover})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }
            : undefined
        }
      >
        {!cover && (
          <div className="flex h-full flex-col justify-end bg-gradient-to-t from-black/40 to-transparent p-5">
            <div className="text-lg font-semibold leading-snug text-white drop-shadow">
              {content.title || "笔记标题"}
            </div>
          </div>
        )}
      </div>
      <div className="px-4 py-4">
        {cover && (
          <h2 className="mb-3 text-[17px] font-bold leading-snug text-stone-900">
            {content.title || "笔记标题"}
          </h2>
        )}
        <div
          className="xhs-body text-[15px] text-stone-700"
          dangerouslySetInnerHTML={{
            __html: renderXhsBody(content.body || "正文待生成"),
          }}
        />
        {(content.tags || []).length > 0 && (
          <div className="mt-5 flex flex-wrap gap-2 border-t border-stone-100 pt-4">
            {content.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-600"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function DouyinPreview({ content }: { content: ContentProject["platforms"]["douyin"] }) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white shadow-sm">
      <div className="border-b border-stone-100 px-4 py-3 text-xs tracking-wide text-stone-400">
        抖音口播预览
      </div>
      <div className="p-4">
        <div className="rounded-xl bg-gradient-to-br from-stone-900 to-stone-800 p-5 text-white">
          <div className="text-xs uppercase tracking-wider text-stone-400">3 秒钩子</div>
          <div className="mt-2 text-xl font-semibold leading-snug">{content.hook || "钩子待生成"}</div>
          <div className="mt-3 inline-block rounded-full bg-white/10 px-3 py-1 text-xs text-stone-300">
            预计时长 {content.duration || "90s"}
          </div>
        </div>

        <div className="mt-4 space-y-3">
          {(content.script || []).map((scene) => (
            <div
              key={scene.index}
              className="rounded-xl border border-stone-200 bg-stone-50/80 p-4"
            >
              <div className="flex items-center gap-2 text-xs text-stone-500">
                <span className="rounded bg-stone-900 px-2 py-0.5 font-medium text-white">
                  {scene.index}
                </span>
                <span>{scene.duration}</span>
                {scene.subtitle && (
                  <>
                    <span>·</span>
                    <span className="text-amber-700">{scene.subtitle}</span>
                  </>
                )}
              </div>
              <p className="mt-2 text-[15px] leading-relaxed text-stone-800">{scene.narration}</p>
              {scene.visual && (
                <p className="mt-2 text-xs text-stone-500">画面：{scene.visual}</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function PreviewPanel({
  project,
  platform,
}: {
  project: ContentProject;
  platform: Platform;
}) {
  if (platform === "wechat") {
    return (
      <WechatPreview
        content={project.platforms.wechat}
        coverAssets={project.cover_assets}
      />
    );
  }
  if (platform === "xiaohongshu") {
    return <XiaohongshuPreview content={project.platforms.xiaohongshu} />;
  }
  return <DouyinPreview content={project.platforms.douyin} />;
}

export function getPlatformCopyText(project: ContentProject, platform: Platform): string {
  if (platform === "wechat") {
    return getWechatPlainText(project.platforms.wechat);
  }
  if (platform === "xiaohongshu") {
    const c = project.platforms.xiaohongshu;
    return `${c.title}\n\n${c.body}\n\n${c.tags.map((t) => `#${t}`).join(" ")}`;
  }
  const c = project.platforms.douyin;
  return [
    `钩子：${c.hook}`,
    `时长：${c.duration}`,
    ...c.script.map((s) => `${s.index}. [${s.duration}] ${s.narration} | ${s.subtitle}`),
  ].join("\n");
}

export function getWechatCopyHtml(project: ContentProject): string {
  return renderWechatCopyHtml(
    project.platforms.wechat,
    project.cover_assets,
    resolveImageUrl,
  );
}

export { platformLabels };
