"use client";

import type { ContentProject, CoverAsset, WechatStyleTheme } from "@/lib/types";
import { resolveImageUrl } from "@/lib/export";
import {
  renderWechatBodyInlineHtml,
  splitWechatPreviewBlocks,
} from "@/lib/wechat-html";
import { WechatInlineImageSlot } from "./WechatInlineImageSlot";

interface WechatPreviewBodyProps {
  body: string;
  theme?: Partial<WechatStyleTheme>;
  coverAssets: CoverAsset[];
  projectId?: string;
  onProjectUpdate?: (project: ContentProject) => void;
}

export function WechatPreviewBody({
  body,
  theme,
  coverAssets,
  projectId,
  onProjectUpdate,
}: WechatPreviewBodyProps) {
  const blocks = splitWechatPreviewBlocks(body || "正文待生成");

  return (
    <div
      className="article-body text-[16px] text-stone-800"
      key={coverAssets
        .map((a) => `${a.asset_index ?? "?"}:${a.image_url ?? ""}:${a.source ?? ""}`)
        .join("|")}
    >
      {blocks.map((block, index) => {
        if (block.type === "image") {
          if (!projectId) {
            return (
              <div
                key={`img-${block.assetIndex}-${index}`}
                dangerouslySetInnerHTML={{
                  __html: renderWechatBodyInlineHtml(
                    `![${block.caption}](__IMAGE_${block.assetIndex}__)`,
                    theme,
                    coverAssets,
                    resolveImageUrl,
                  ),
                }}
              />
            );
          }
          return (
            <WechatInlineImageSlot
              key={`img-${block.assetIndex}-${index}`}
              projectId={projectId}
              assetIndex={block.assetIndex}
              caption={block.caption}
              coverAssets={coverAssets}
              onUpdate={onProjectUpdate}
            />
          );
        }
        if (!block.text.trim()) return null;
        return (
          <div
            key={`md-${index}`}
            dangerouslySetInnerHTML={{
              __html: renderWechatBodyInlineHtml(
                block.text,
                theme,
                coverAssets,
                resolveImageUrl,
              ),
            }}
          />
        );
      })}
    </div>
  );
}
