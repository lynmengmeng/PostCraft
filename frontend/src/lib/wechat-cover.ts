import type { ContentProject, CoverAsset } from "./types";

import { authHeaders } from "./auth";

/** 公众号头条封面比例（消息列表） */
export const WECHAT_COVER_RATIO = 2.35;

/** 推荐导出尺寸，与公众号后台一致 */
export const WECHAT_COVER_EXPORT = { width: 900, height: 383 };

export interface WechatCoverCrop {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function isWechatCoverAsset(
  asset: CoverAsset,
  index: number,
  placements: ContentProject["platforms"]["wechat"]["image_placements"] = [],
): boolean {
  const assetIndex = asset.asset_index ?? index;
  const inBody = placements.some((p) => p.asset_index === assetIndex);
  if (inBody) return false;
  if (asset.after_paragraph != null && asset.after_paragraph >= 0) return false;
  return index === 0 || asset.after_paragraph === -1;
}

/** 从 2.35:1 横幅中截取公众号 1:1 预览区域（居中方形） */
export function computeSquareFromBanner(crop: WechatCoverCrop): WechatCoverCrop {
  const size = Math.min(crop.width, crop.height);
  return {
    x: crop.x + (crop.width - size) / 2,
    y: crop.y + (crop.height - size) / 2,
    width: size,
    height: size,
  };
}

export function computeDefaultCrop(naturalWidth: number, naturalHeight: number): WechatCoverCrop {
  const ratio = WECHAT_COVER_RATIO;
  let cropWidth = naturalWidth;
  let cropHeight = cropWidth / ratio;

  if (cropHeight > naturalHeight) {
    cropHeight = naturalHeight;
    cropWidth = cropHeight * ratio;
  }

  const x = Math.max(0, (naturalWidth - cropWidth) / 2);
  const isPortrait = naturalHeight > naturalWidth * 1.1;
  const focusY = isPortrait ? naturalHeight * 0.28 : naturalHeight * 0.5;
  const y = clamp(focusY - cropHeight / 2, 0, naturalHeight - cropHeight);

  return { x, y, width: cropWidth, height: cropHeight };
}

export function clampCrop(
  crop: WechatCoverCrop,
  naturalWidth: number,
  naturalHeight: number,
): WechatCoverCrop {
  const width = Math.min(crop.width, naturalWidth);
  const height = Math.min(crop.height, naturalHeight);
  return {
    width,
    height,
    x: clamp(crop.x, 0, naturalWidth - width),
    y: clamp(crop.y, 0, naturalHeight - height),
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export async function fetchImageBlobUrl(url: string): Promise<string> {
  const response = await fetch(url, { headers: authHeaders() });
  if (!response.ok) throw new Error("封面图片加载失败");
  const blob = await response.blob();
  return URL.createObjectURL(blob);
}

export function loadImageElement(blobUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("封面图片加载失败"));
    img.src = blobUrl;
  });
}

export function cropRegionToCanvas(
  img: HTMLImageElement,
  crop: WechatCoverCrop,
  outputWidth: number,
  outputHeight: number,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = outputWidth;
  canvas.height = outputHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("无法创建画布");
  ctx.drawImage(
    img,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    outputWidth,
    outputHeight,
  );
  return canvas;
}

export async function exportWechatCoverImage(
  blobUrl: string,
  crop: WechatCoverCrop,
  filename: string,
): Promise<void> {
  const img = await loadImageElement(blobUrl);
  const canvas = cropRegionToCanvas(
    img,
    crop,
    WECHAT_COVER_EXPORT.width,
    WECHAT_COVER_EXPORT.height,
  );
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("封面导出失败"))),
      "image/jpeg",
      0.92,
    );
  });
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(objectUrl);
}
