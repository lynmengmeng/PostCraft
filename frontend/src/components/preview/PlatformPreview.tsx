"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ContentProject, DouyinScene, Platform } from "@/lib/types";
import { platformLabels } from "@/lib/api";
import { resolveImageUrl } from "@/lib/export";
import { wechatCoverAssets } from "@/lib/cover-assets";
import { hasRealImage } from "@/lib/wechat-assets";
import { isWechatCoverAsset } from "@/lib/wechat-cover";
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
  const placements = content.image_placements ?? [];
  const wechatAssets = wechatCoverAssets(coverAssets);
  const coverAsset = wechatAssets.find((asset, index) =>
    isWechatCoverAsset(asset, index, placements) && hasRealImage(asset),
  );
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
        {coverAsset?.image_url && (
          <div className="mt-4 overflow-hidden rounded-xl">
            <img
              src={resolveImageUrl(coverAsset.image_url)}
              alt={coverAsset.caption || coverAsset.headline || "公众号封面"}
              className="aspect-[2.35/1] w-full object-cover"
            />
            {(coverAsset.caption || coverAsset.subheadline) && (
              <p className="mt-2 text-center text-xs text-stone-400">
                {coverAsset.caption || coverAsset.subheadline}
              </p>
            )}
          </div>
        )}
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
  const carousel = (content.carousel_images || []).filter(Boolean);
  const images = carousel.length > 0 ? carousel : content.cover_image ? [content.cover_image] : [];
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollerRef = useRef<HTMLDivElement>(null);

  const scrollToIndex = useCallback((index: number) => {
    const node = scrollerRef.current;
    if (!node) return;
    const width = node.clientWidth;
    node.scrollTo({ left: width * index, behavior: "smooth" });
    setActiveIndex(index);
  }, []);

  useEffect(() => {
    setActiveIndex(0);
    scrollerRef.current?.scrollTo({ left: 0 });
  }, [images.join("|")]);

  function handleScroll() {
    const node = scrollerRef.current;
    if (!node || node.clientWidth <= 0) return;
    const index = Math.round(node.scrollLeft / node.clientWidth);
    if (index !== activeIndex && index >= 0 && index < images.length) {
      setActiveIndex(index);
    }
  }

  return (
    <div className="xhs-preview mx-auto max-w-[360px] overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-sm">
      <div className="relative aspect-[3/4] overflow-hidden bg-gradient-to-br from-rose-50 to-orange-100">
        {images.length > 0 ? (
          <div
            ref={scrollerRef}
            onScroll={handleScroll}
            className="flex h-full w-full snap-x snap-mandatory overflow-x-auto scroll-smooth [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {images.map((image, index) => (
              <div
                key={`${image}-${index}`}
                className="relative h-full w-full shrink-0 snap-center snap-always bg-stone-100"
              >
                <img
                  src={resolveImageUrl(image)}
                  alt={`${content.title || "笔记"} 第 ${index + 1} 张`}
                  className="h-full w-full object-cover"
                  draggable={false}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="flex h-full flex-col justify-end bg-gradient-to-t from-black/40 to-transparent p-5">
            <div className="text-lg font-semibold leading-snug text-white drop-shadow">
              {content.title || "笔记标题"}
            </div>
          </div>
        )}

        {images.length > 1 && (
          <>
            <button
              type="button"
              aria-label="上一张"
              disabled={activeIndex <= 0}
              onClick={() => scrollToIndex(Math.max(0, activeIndex - 1))}
              className="absolute left-2 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/35 text-white backdrop-blur disabled:opacity-30"
            >
              ‹
            </button>
            <button
              type="button"
              aria-label="下一张"
              disabled={activeIndex >= images.length - 1}
              onClick={() => scrollToIndex(Math.min(images.length - 1, activeIndex + 1))}
              className="absolute right-2 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/35 text-white backdrop-blur disabled:opacity-30"
            >
              ›
            </button>
            <div className="pointer-events-none absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
              {images.map((_, index) => (
                <span
                  key={index}
                  className={`h-1.5 rounded-full transition-all ${
                    index === activeIndex ? "w-4 bg-white" : "w-1.5 bg-white/50"
                  }`}
                />
              ))}
            </div>
            <div className="pointer-events-none absolute right-3 top-3 rounded-full bg-black/45 px-2 py-0.5 text-[11px] text-white">
              {activeIndex + 1}/{images.length}
            </div>
          </>
        )}
      </div>
      {content.image_pages && content.image_pages.length > 0 && (
        <div className="border-b border-stone-100 px-4 py-2 text-xs text-stone-500">
          图集方案：{content.image_pages.length} 张
          {content.cover_style ? ` · ${content.cover_style.replace(/_/g, " ").slice(0, 24)}` : ""}
        </div>
      )}
      <div className="px-4 py-4">
        {images.length > 0 && (
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
