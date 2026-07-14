"use client";

import { resolveImageUrl } from "@/lib/export";
import { useCoverAssetActions } from "@/hooks/useCoverAssetActions";
import type { ContentProject, CoverAsset } from "@/lib/types";
import { getCoverAssetByIndex, hasRealImage, isPlaceholderAsset } from "@/lib/wechat-assets";
import { inlineFormat } from "@/lib/markdown";

interface WechatInlineImageSlotProps {
  projectId: string;
  assetIndex: number;
  caption: string;
  coverAssets: CoverAsset[];
  onUpdate?: (project: ContentProject) => void;
}

export function WechatInlineImageSlot({
  projectId,
  assetIndex,
  caption,
  coverAssets,
  onUpdate,
}: WechatInlineImageSlotProps) {
  const asset = getCoverAssetByIndex(coverAssets, assetIndex);
  const label =
    asset?.caption || asset?.subheadline || caption || `配图${assetIndex + 1}`;
  const { fileInputRef, uploading, generating, error, handleUpload, handleGenerate, openFilePicker } =
    useCoverAssetActions(projectId, asset, assetIndex, onUpdate, label);
  const busy = uploading || generating;
  const canAct = Boolean(onUpdate);

  return (
    <section style={{ margin: "20px 0", textAlign: "center" }}>
      {asset && hasRealImage(asset) ? (
        <>
          <img
            key={`${asset.id}-${asset.image_url}-${asset.source}`}
            src={resolveImageUrl(asset.image_url)}
            alt={label}
            style={{
              width: "100%",
              maxWidth: "100%",
              borderRadius: "8px",
              display: "block",
              margin: "0 auto",
            }}
          />
          <p
            style={{
              fontSize: "13px",
              color: "#999",
              marginTop: "8px",
              lineHeight: 1.5,
            }}
            dangerouslySetInnerHTML={{ __html: inlineFormat(label) }}
          />
          {canAct && (
            <div className="mt-2 flex justify-center gap-3">
              <button
                type="button"
                disabled={busy}
                onClick={openFilePicker}
                className="text-xs text-stone-500 underline hover:text-stone-700 disabled:opacity-50"
              >
                重新上传
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleGenerate()}
                className="text-xs text-stone-500 underline hover:text-stone-700 disabled:opacity-50"
              >
                重新 AI 生成
              </button>
            </div>
          )}
        </>
      ) : (
        <div
          className="mx-auto flex max-w-full flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-stone-300 bg-gradient-to-b from-stone-50 to-stone-100/80 px-4 py-10"
          style={{ minHeight: "180px" }}
        >
          <div className="text-center">
            <p className="text-sm font-medium text-stone-600">{label}</p>
            <p className="mt-1 text-xs text-stone-400">配图占位 · 确认正文后可在此处理</p>
          </div>
          {asset?.image_url && isPlaceholderAsset(asset) && (
            <img
              src={resolveImageUrl(asset.image_url)}
              alt=""
              className="max-h-24 max-w-[85%] object-contain opacity-70"
            />
          )}
          {canAct && (
            <div className="flex flex-wrap justify-center gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={openFilePicker}
                className="rounded-lg border border-stone-300 bg-white px-4 py-2 text-xs font-medium text-stone-700 shadow-sm hover:bg-stone-50 disabled:opacity-50"
              >
                {uploading ? "上传中…" : "上传图片"}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleGenerate()}
                className="rounded-lg bg-stone-900 px-4 py-2 text-xs font-medium text-white shadow-sm hover:bg-stone-800 disabled:opacity-50"
              >
                {generating ? "生成中…" : "AI 生成"}
              </button>
            </div>
          )}
        </div>
      )}

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

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

    </section>
  );
}
