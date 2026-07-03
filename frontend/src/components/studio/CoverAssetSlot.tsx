"use client";

import { downloadImage, resolveImageUrl } from "@/lib/export";
import { useCoverAssetActions } from "@/hooks/useCoverAssetActions";
import type { ContentProject, CoverAsset } from "@/lib/types";
import { hasRealImage, isPlaceholderAsset } from "@/lib/wechat-assets";
import { WechatCoverEditor } from "@/components/studio/WechatCoverEditor";

interface CoverAssetSlotProps {
  projectId: string;
  asset: CoverAsset;
  index: number;
  placementLabel: string;
  isCover: boolean;
  onUpdate: (project: ContentProject) => void;
}

export function CoverAssetSlot({
  projectId,
  asset,
  index,
  placementLabel,
  isCover,
  onUpdate,
}: CoverAssetSlotProps) {
  const assetIndex = asset.asset_index ?? index;
  const pending = isPlaceholderAsset(asset) || !hasRealImage(asset);
  const { fileInputRef, uploading, generating, error, handleUpload, handleGenerate, openFilePicker } =
    useCoverAssetActions(projectId, asset, assetIndex, onUpdate);

  return (
    <div className="mt-3 rounded-lg bg-surface-container-low p-3 text-sm">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
          {placementLabel}
        </span>
        {asset.source === "upload" && hasRealImage(asset) && (
          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] text-emerald-700">
            已上传
          </span>
        )}
        {asset.source === "generated" && hasRealImage(asset) && (
          <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[10px] text-sky-700">
            AI 生成
          </span>
        )}
        {hasRealImage(asset) && !isCover && (
          <button
            type="button"
            onClick={() =>
              downloadImage(asset.image_url!, `${asset.headline || "配图"}-${index + 1}.jpg`)
            }
            className="text-xs text-primary underline"
          >
            下载
          </button>
        )}
      </div>

      {hasRealImage(asset) ? (
        isCover ? (
          <div className="mb-2">
            <WechatCoverEditor
              key={asset.image_url}
              imageUrl={asset.image_url!}
              filename={`${asset.headline || "公众号封面"}.jpg`}
            />
          </div>
        ) : (
          <img
            src={resolveImageUrl(asset.image_url)}
            alt={asset.headline}
            className="mb-2 w-full rounded-lg object-cover"
          />
        )
      ) : (
        <div
          className={`mb-2 flex w-full flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-stone-300 bg-stone-50 text-stone-500 ${
            isCover ? "aspect-[2.35/1]" : "aspect-[4/3]"
          }`}
        >
          {asset.image_url && isPlaceholderAsset(asset) ? (
            <img
              src={resolveImageUrl(asset.image_url)}
              alt=""
              className="max-h-[60%] max-w-[85%] object-contain opacity-90"
            />
          ) : (
            <span className="text-xs">待配图</span>
          )}
          {pending && (
            <div className="flex w-full flex-wrap justify-end gap-2 px-3 pb-3">
              <button
                type="button"
                disabled={uploading || generating}
                onClick={openFilePicker}
                className="rounded-lg border border-stone-300 bg-white px-3.5 py-2 text-xs font-medium text-stone-800 shadow-sm hover:bg-stone-50 disabled:opacity-50"
              >
                {uploading ? "上传中…" : "上传图片"}
              </button>
              <button
                type="button"
                disabled={uploading || generating}
                onClick={() => void handleGenerate()}
                className="rounded-lg bg-stone-900 px-3.5 py-2 text-xs font-medium text-white shadow-sm hover:bg-stone-800 disabled:opacity-50"
              >
                {generating ? "生成中…" : "AI 生成"}
              </button>
            </div>
          )}
        </div>
      )}

      {hasRealImage(asset) && (
        <div className="mb-2 flex justify-end gap-2">
          <button
            type="button"
            disabled={uploading || generating}
            onClick={openFilePicker}
            className="rounded-lg border border-stone-300 bg-white px-3.5 py-2 text-xs font-medium text-stone-800 shadow-sm hover:bg-stone-50 disabled:opacity-50"
          >
            {uploading ? "上传中…" : "重新上传"}
          </button>
          <button
            type="button"
            disabled={uploading || generating}
            onClick={() => void handleGenerate()}
            className="rounded-lg bg-stone-900 px-3.5 py-2 text-xs font-medium text-white shadow-sm hover:bg-stone-800 disabled:opacity-50"
          >
            {generating ? "生成中…" : "重新 AI 生成"}
          </button>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleUpload(file);
        }}
      />

      {error && <p className="mb-2 text-xs text-red-600">{error}</p>}

      <div className="font-medium">{asset.headline}</div>
      <div className="text-on-surface-variant">{asset.caption || asset.subheadline}</div>
      {pending && (
        <div className="mt-2 text-xs text-on-surface-variant/60">{asset.prompt}</div>
      )}
    </div>
  );
}
