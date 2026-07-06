"use client";

import { wechatCoverAssets } from "@/lib/cover-assets";
import type { ContentProject } from "@/lib/types";
import { isWechatCoverAsset } from "@/lib/wechat-cover";
import { getImagePlacementLabel } from "@/lib/wechat-html";
import { CoverAssetSlot } from "./CoverAssetSlot";

interface WechatCoverAssetsPanelProps {
  project: ContentProject;
  onUpdate: (project: ContentProject) => void;
}

export function WechatCoverAssetsPanel({ project, onUpdate }: WechatCoverAssetsPanelProps) {
  const assets = wechatCoverAssets(project.cover_assets);
  const placements = project.platforms.wechat.image_placements;

  return (
    <div className="rounded-xl border border-outline-variant/20 bg-surface-container-low/50 p-4">
      <h3 className="text-sm font-medium text-on-surface-variant">公众号封面与配图</h3>
      <p className="mt-2 text-xs leading-relaxed text-on-surface-variant/70">
        横版封面 2.35:1，正文配图按段落位置插入。与小红书轮播图互不影响。
      </p>
      {assets.length === 0 ? (
        <p className="mt-3 text-sm leading-relaxed text-on-surface-variant">
          生成公众号内容后会自动创建封面与配图占位。也可在对话中发送「生成封面配图」。
        </p>
      ) : (
        assets.map((asset, index) => {
          const placement = placements?.find((p) => p.asset_index === (asset.asset_index ?? index));
          const placementLabel = placement
            ? getImagePlacementLabel(placement, asset)
            : asset.after_paragraph != null && asset.after_paragraph >= 0
              ? getImagePlacementLabel(
                  {
                    after_paragraph: asset.after_paragraph,
                    asset_index: index,
                    caption: asset.caption || "",
                  },
                  asset,
                )
              : index === 0 || asset.after_paragraph === -1
                ? "封面候选"
                : "正文配图";
          const isCover = isWechatCoverAsset(asset, index, placements);
          return (
            <CoverAssetSlot
              key={asset.id}
              projectId={project.id}
              asset={asset}
              index={index}
              placementLabel={placementLabel}
              isCover={isCover}
              variant="wechat"
              onUpdate={onUpdate}
            />
          );
        })
      )}
    </div>
  );
}
