"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { resolveImageUrl } from "@/lib/export";
import {
  WECHAT_COVER_RATIO,
  clampCrop,
  computeDefaultCrop,
  computeSquareFromBanner,
  exportWechatCoverImage,
  fetchImageBlobUrl,
  loadImageElement,
  type WechatCoverCrop,
} from "@/lib/wechat-cover";

interface WechatCoverEditorProps {
  imageUrl: string;
  filename: string;
}

export function WechatCoverEditor({ imageUrl, filename }: WechatCoverEditorProps) {
  const resolvedUrl = resolveImageUrl(imageUrl);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startX: number; startY: number; cropX: number; cropY: number } | null>(
    null,
  );

  const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 });
  const [crop, setCrop] = useState<WechatCoverCrop | null>(null);
  const [blobUrl, setBlobUrl] = useState("");
  const blobUrlRef = useRef("");
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    fetchImageBlobUrl(resolvedUrl)
      .then(async (url) => {
        if (cancelled) {
          URL.revokeObjectURL(url);
          return;
        }
        blobUrlRef.current = url;
        setBlobUrl(url);
        const img = await loadImageElement(url);
        if (cancelled) return;
        setNaturalSize({ width: img.naturalWidth, height: img.naturalHeight });
        setCrop(computeDefaultCrop(img.naturalWidth, img.naturalHeight));
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      });

    return () => {
      cancelled = true;
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = "";
      }
    };
  }, [resolvedUrl]);

  const squareCrop = crop ? computeSquareFromBanner(crop) : null;

  const handlePointerDown = useCallback(
    (event: React.PointerEvent) => {
      if (!crop) return;
      event.preventDefault();
      (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
      dragRef.current = {
        startX: event.clientX,
        startY: event.clientY,
        cropX: crop.x,
        cropY: crop.y,
      };
    },
    [crop],
  );

  const handlePointerMove = useCallback(
    (event: React.PointerEvent) => {
      const drag = dragRef.current;
      const container = containerRef.current;
      if (!drag || !container || !crop || naturalSize.width === 0) return;

      const rect = container.getBoundingClientRect();
      const scaleX = naturalSize.width / rect.width;
      const scaleY = naturalSize.height / rect.height;
      const next = clampCrop(
        {
          ...crop,
          x: drag.cropX + (event.clientX - drag.startX) * scaleX,
          y: drag.cropY + (event.clientY - drag.startY) * scaleY,
        },
        naturalSize.width,
        naturalSize.height,
      );
      setCrop(next);
    },
    [crop, naturalSize.height, naturalSize.width],
  );

  const handlePointerUp = useCallback((event: React.PointerEvent) => {
    dragRef.current = null;
    (event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId);
  }, []);

  async function handleExport() {
    if (!crop || !blobUrl) return;
    setExporting(true);
    setError("");
    try {
      await exportWechatCoverImage(blobUrl, crop, filename);
    } catch (err) {
      setError(err instanceof Error ? err.message : "导出失败");
    } finally {
      setExporting(false);
    }
  }

  if (error && !crop) {
    return <p className="text-xs text-error">{error}</p>;
  }

  if (!crop || naturalSize.width === 0) {
    return (
      <div className="flex aspect-[2.35/1] items-center justify-center rounded-lg bg-surface-container text-xs text-on-surface-variant">
        加载封面…
      </div>
    );
  }

  const cropLeftPct = (crop.x / naturalSize.width) * 100;
  const cropTopPct = (crop.y / naturalSize.height) * 100;
  const cropWidthPct = (crop.width / naturalSize.width) * 100;
  const cropHeightPct = (crop.height / naturalSize.height) * 100;

  const squareLeftPct = squareCrop
    ? ((squareCrop.x - crop.x) / crop.width) * 100
    : 0;
  const squareWidthPct = squareCrop ? (squareCrop.width / crop.width) * 100 : 0;

  return (
    <div className="space-y-2">
      <p className="text-xs leading-relaxed text-on-surface-variant/80">
        公众号封面需 2.35:1（900×383）。拖动选框调整构图，确保右侧 1:1 预览也包含主体后再下载。
      </p>
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_140px]">
        <div
          ref={containerRef}
          className="relative overflow-hidden rounded-lg bg-stone-900/90"
          style={{ aspectRatio: `${naturalSize.width} / ${naturalSize.height}` }}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          <img
            src={blobUrl}
            alt="封面原图"
            className="block h-full w-full object-contain opacity-40"
            draggable={false}
          />
          <div
            className="absolute overflow-hidden rounded-sm ring-2 ring-white/90"
            style={{
              left: `${cropLeftPct}%`,
              top: `${cropTopPct}%`,
              width: `${cropWidthPct}%`,
              height: `${cropHeightPct}%`,
              cursor: "move",
              touchAction: "none",
            }}
            onPointerDown={handlePointerDown}
          >
            <img
              src={blobUrl}
              alt=""
              className="absolute max-w-none"
              style={{
                width: `${(naturalSize.width / crop.width) * 100}%`,
                height: `${(naturalSize.height / crop.height) * 100}%`,
                left: `${(-crop.x / crop.width) * 100}%`,
                top: `${(-crop.y / crop.height) * 100}%`,
              }}
              draggable={false}
            />
            {squareCrop && (
              <div
                className="pointer-events-none absolute border border-dashed border-amber-300/80"
                style={{
                  left: `${squareLeftPct}%`,
                  top: "0",
                  width: `${squareWidthPct}%`,
                  height: "100%",
                }}
              />
            )}
          </div>
        </div>

        <div className="space-y-2">
          <PreviewCard
            label="2.35:1 消息列表"
            imageUrl={blobUrl}
            crop={crop}
            naturalSize={naturalSize}
            aspectClass="aspect-[2.35/1]"
          />
          <PreviewCard
            label="1:1 转发卡片"
            imageUrl={blobUrl}
            crop={squareCrop ?? crop}
            naturalSize={naturalSize}
            aspectClass="aspect-square"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() =>
            setCrop(computeDefaultCrop(naturalSize.width, naturalSize.height))
          }
          className="rounded-lg border border-outline-variant/30 px-3 py-1 text-xs text-on-surface-variant hover:bg-surface-container"
        >
          重置构图
        </button>
        <button
          type="button"
          onClick={() => void handleExport()}
          disabled={exporting}
          className="rounded-lg bg-primary px-3 py-1 text-xs text-white disabled:opacity-50"
        >
          {exporting ? "导出中…" : "下载公众号封面 (900×383)"}
        </button>
        <span className="text-[10px] text-on-surface-variant/60">
          比例 {WECHAT_COVER_RATIO}:1
        </span>
      </div>
      {error && <p className="text-xs text-error">{error}</p>}
    </div>
  );
}

function PreviewCard({
  label,
  imageUrl,
  crop,
  naturalSize,
  aspectClass,
}: {
  label: string;
  imageUrl: string;
  crop: WechatCoverCrop;
  naturalSize: { width: number; height: number };
  aspectClass: string;
}) {
  return (
    <div>
      <div className="mb-1 text-[10px] text-on-surface-variant/70">{label}</div>
      <div
        className={`relative overflow-hidden rounded-md border border-outline-variant/20 bg-stone-100 ${aspectClass}`}
      >
        <img
          src={imageUrl}
          alt=""
          className="absolute max-w-none"
          style={{
            width: `${(naturalSize.width / crop.width) * 100}%`,
            height: `${(naturalSize.height / crop.height) * 100}%`,
            left: `${(-crop.x / crop.width) * 100}%`,
            top: `${(-crop.y / crop.height) * 100}%`,
          }}
          draggable={false}
        />
      </div>
    </div>
  );
}
