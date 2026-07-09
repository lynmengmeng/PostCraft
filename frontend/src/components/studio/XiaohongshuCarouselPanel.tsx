"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import {
  hasXiaohongshuCarouselPlan,
  xiaohongshuAssetNeedsGeneration,
  xiaohongshuCarouselAssets,
  xiaohongshuCarouselLabel,
} from "@/lib/cover-assets";
import type { ContentProject } from "@/lib/types";
import { CoverAssetSlot } from "./CoverAssetSlot";

interface XiaohongshuCarouselPanelProps {
  project: ContentProject;
  generating: boolean;
  onGeneratingChange: (value: boolean) => void;
  onUpdate: (project: ContentProject) => void;
  onError?: (message: string) => void;
}

export function XiaohongshuCarouselPanel({
  project,
  generating,
  onGeneratingChange,
  onUpdate,
  onError,
}: XiaohongshuCarouselPanelProps) {
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const assets = xiaohongshuCarouselAssets(project.cover_assets);
  const imagePages = project.platforms.xiaohongshu.image_pages;
  const hasBody = !!project.platforms.xiaohongshu.body;

  async function handleBatchGenerate() {
    onGeneratingChange(true);
    setProgress(null);
    try {
      let current = project;
      let carouselAssets = xiaohongshuCarouselAssets(current.cover_assets);

      if (carouselAssets.length === 0) {
        current = await api.ensureXiaohongshuCarouselPlan(project.id);
        onUpdate(current);
        carouselAssets = xiaohongshuCarouselAssets(current.cover_assets);
      }

      const pending = carouselAssets.filter((asset) => xiaohongshuAssetNeedsGeneration(asset));
      if (pending.length === 0) {
        throw new Error("轮播图已全部生成");
      }

      setProgress({ current: 0, total: pending.length });

      // 逐张生成，避免网关 120s 超时（批量串行易触发 504）
      for (let i = 0; i < pending.length; i += 1) {
        const asset = pending[i];
        const assetIndex = asset.asset_index ?? current.cover_assets.indexOf(asset);
        if (assetIndex < 0) {
          throw new Error("轮播配图索引无效");
        }
        current = await api.generateAssetImage(project.id, assetIndex);
        onUpdate(current);
        setProgress({ current: i + 1, total: pending.length });
      }
    } catch (err) {
      onError?.(err instanceof Error ? err.message : "批量生成失败");
    } finally {
      setProgress(null);
      onGeneratingChange(false);
    }
  }

  const progressLabel =
    progress && progress.total > 0
      ? `轮播生成中 ${progress.current}/${progress.total}…`
      : generating
        ? "轮播生成中…"
        : "一键生成全部轮播图";

  return (
    <div className="rounded-xl border border-outline-variant/20 bg-surface-container-low/50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-medium text-on-surface-variant">小红书轮播配图</h3>
          <p className="mt-2 text-xs leading-relaxed text-on-surface-variant/70">
            3:4 竖版，按内容自动规划 1–6 张（短笔记可单图）。与公众号封面/正文配图独立。
          </p>
        </div>
        {hasBody && (
          <button
            type="button"
            disabled={generating}
            onClick={() => void handleBatchGenerate()}
            className="shrink-0 rounded-lg bg-stone-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
          >
            {progressLabel}
          </button>
        )}
      </div>

      {!hasBody ? (
        <p className="mt-3 text-sm leading-relaxed text-on-surface-variant">
          请先生成小红书内容，系统会根据篇幅自动规划 1–6 张配图（短内容可能只需 1 张）。
        </p>
      ) : assets.length === 0 ? (
        <p className="mt-3 text-sm leading-relaxed text-on-surface-variant">
          轮播方案待创建。点击上方按钮，或在对话中发送「生成小红书配图」。
        </p>
      ) : (
        assets.map((asset, index) => (
          <CoverAssetSlot
            key={asset.id ?? `${asset.asset_index}-${index}`}
            projectId={project.id}
            asset={asset}
            index={index}
            placementLabel={xiaohongshuCarouselLabel(asset, index, imagePages)}
            variant="xiaohongshu"
            onUpdate={onUpdate}
          />
        ))
      )}

      {hasBody && hasXiaohongshuCarouselPlan(project) && assets.length > 0 && (
        <p className="mt-3 text-xs text-on-surface-variant/60">
          已规划 {assets.length} 张 · 已生成{" "}
          {project.platforms.xiaohongshu.carousel_images?.length ?? 0} 张
        </p>
      )}
    </div>
  );
}
