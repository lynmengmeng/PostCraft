"use client";

import type { ContentProject, DouyinScene, Platform } from "@/lib/types";
import { platformLabels } from "@/lib/api";
import { resolveImageUrl } from "@/lib/export";
import { renderXhsBody } from "@/lib/markdown";
import {
  getWechatPlainText,
  LAYOUT_PRESET_LABELS,
  normalizeStyleTheme,
  renderWechatCopyHtml,
} from "@/lib/wechat-html";
import { WechatPreviewBody } from "./WechatPreviewBody";

function parseDurationSec(value: string): number {
  const match = value.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

function totalScriptSeconds(script: DouyinScene[]): number {
  return script.reduce((sum, scene) => sum + parseDurationSec(scene.duration), 0);
}

const PREVIEW_DISCLAIMER = "近似预览效果，以各平台实际展示为准。";

export function WechatPreview({
  content,
  coverAssets = [],
  projectId,
  onProjectUpdate,
}: {
  content: ContentProject["platforms"]["wechat"];
  coverAssets?: ContentProject["cover_assets"];
  projectId?: string;
  onProjectUpdate?: (project: ContentProject) => void;
}) {
  const theme = normalizeStyleTheme(content.style_theme);
  const accent = theme.accent;
  const preset = theme.layout_preset || "classic";
  const summaryStyle =
    preset === "classic"
      ? { borderLeftColor: "#fbbf24", background: "#fffbeb" }
      : {
          borderLeftColor: theme.quote_border,
          background: theme.quote_bg,
        };

  return (
    <div className="wechat-preview mx-auto max-w-[480px] overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
      <div className="border-b border-stone-100 bg-stone-50 px-5 py-3 text-xs tracking-wide text-stone-400">
        公众号预览
        <span className="ml-2 rounded-full bg-stone-200/80 px-2 py-0.5 text-[10px] text-stone-600">
          {LAYOUT_PRESET_LABELS[preset]}
        </span>
        {theme.mood && (
          <span className="ml-1 rounded-full bg-stone-200/80 px-2 py-0.5 text-[10px] text-stone-600">
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
        <div className="mt-6" style={{ ["--wechat-accent" as string]: accent }}>
          <WechatPreviewBody
            body={content.body || "正文待生成"}
            theme={theme}
            coverAssets={coverAssets}
            projectId={projectId}
            onProjectUpdate={onProjectUpdate}
          />
        </div>
        <p className="mt-6 rounded-lg bg-stone-50 px-3 py-2 text-xs leading-relaxed text-stone-500">
          {PREVIEW_DISCLAIMER}
          配图占位可直接在上方点击「上传图片」或「AI 生成」；复制富文本请用顶栏按钮。
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
        <p className="mt-4 text-xs leading-relaxed text-stone-400">{PREVIEW_DISCLAIMER}</p>
      </div>
    </div>
  );
}

export function DouyinPreview({ content }: { content: ContentProject["platforms"]["douyin"] }) {
  const targetSec = parseDurationSec(content.duration || "90s");
  const scriptSec = totalScriptSeconds(content.script || []);
  const durationMismatch = scriptSec > 0 && Math.abs(scriptSec - targetSec) > 10;
  return (
    <div className="rounded-2xl border border-stone-200 bg-white shadow-sm">
      <div className="border-b border-stone-100 px-4 py-3 text-xs tracking-wide text-stone-400">
        抖音口播预览
      </div>
      <div className="p-4">
        <div className="rounded-xl bg-gradient-to-br from-stone-900 to-stone-800 p-5 text-white">
          <div className="text-xs uppercase tracking-wider text-stone-400">3 秒钩子</div>
          <div className="mt-2 text-xl font-semibold leading-snug">{content.hook || "钩子待生成"}</div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="inline-block rounded-full bg-white/10 px-3 py-1 text-xs text-stone-300">
              目标时长 {content.duration || "90s"}
            </span>
            {scriptSec > 0 && (
              <span
                className={`inline-block rounded-full px-3 py-1 text-xs ${
                  durationMismatch ? "bg-amber-500/20 text-amber-200" : "bg-white/10 text-stone-300"
                }`}
              >
                分镜合计 {scriptSec}s
                {durationMismatch ? "（与目标偏差较大）" : ""}
              </span>
            )}
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
        <p className="mt-4 text-xs leading-relaxed text-stone-400">{PREVIEW_DISCLAIMER}</p>
      </div>
    </div>
  );
}

export function PreviewPanel({
  project,
  platform,
  onProjectUpdate,
}: {
  project: ContentProject;
  platform: Platform;
  onProjectUpdate?: (project: ContentProject) => void;
}) {
  if (platform === "wechat") {
    return (
      <WechatPreview
        content={project.platforms.wechat}
        coverAssets={project.cover_assets}
        projectId={project.id}
        onProjectUpdate={onProjectUpdate}
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
