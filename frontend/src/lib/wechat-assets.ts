import type { ContentProject, CoverAsset } from "./types";

const IMAGE_MD_RE = /!\[([^\]]*)\]\(([^)]+)\)/g;

export function getCoverAssetByIndex(
  assets: CoverAsset[],
  assetIndex: number,
): CoverAsset | undefined {
  const byIndex = assets.find((a) => a.asset_index === assetIndex);
  if (byIndex) return byIndex;
  return assets[assetIndex];
}

export function isPlaceholderAsset(asset: CoverAsset): boolean {
  return asset.source === "placeholder";
}

export function hasRealImage(asset: CoverAsset): boolean {
  return Boolean(asset.image_url && asset.source !== "placeholder");
}

export function nextAssetIndex(assets: CoverAsset[]): number {
  if (assets.length === 0) return 0;
  const indices = assets.map((asset, index) =>
    asset.asset_index != null && asset.asset_index >= 0 ? asset.asset_index : index,
  );
  return Math.max(...indices) + 1;
}

export function makePlaceholderMarkdown(assetIndex: number, caption = "配图"): string {
  return `![${caption}](__IMAGE_${assetIndex}__)`;
}

export function insertPlaceholderInBody(body: string, assetIndex: number, caption = "配图"): string {
  const block = makePlaceholderMarkdown(assetIndex, caption);
  const trimmed = body.trimEnd();
  return trimmed ? `${trimmed}\n\n${block}\n` : `${block}\n`;
}

export function syncCoverAssetsCaptionsFromBody(
  body: string,
  coverAssets: CoverAsset[],
): CoverAsset[] {
  const refs: { assetIndex: number; caption: string }[] = [];
  let match: RegExpExecArray | null;
  const re = new RegExp(IMAGE_MD_RE.source, "g");
  while ((match = re.exec(body)) !== null) {
    const alt = match[1];
    const src = match[2].trim();
    const placeholder = src.match(/^__IMAGE_(\d+)__$/);
    if (!placeholder) continue;
    refs.push({ assetIndex: Number(placeholder[1]), caption: alt });
  }
  if (refs.length === 0) return coverAssets;

  return coverAssets.map((asset) => {
    const assetIndex = asset.asset_index ?? -1;
    const ref = refs.find((r) => r.assetIndex === assetIndex);
    if (!ref?.caption) return asset;
    return {
      ...asset,
      caption: ref.caption,
      subheadline: asset.subheadline === "正文配图" || !asset.subheadline ? ref.caption : asset.subheadline,
    };
  });
}

export function syncImagePlacementsFromBody(
  body: string,
  coverAssets: CoverAsset[],
): ContentProject["platforms"]["wechat"]["image_placements"] {
  const placements: NonNullable<ContentProject["platforms"]["wechat"]["image_placements"]> = [];
  let match: RegExpExecArray | null;
  const re = new RegExp(IMAGE_MD_RE.source, "g");
  while ((match = re.exec(body)) !== null) {
    const alt = match[1];
    const src = match[2].trim();
    const placeholder = src.match(/^__IMAGE_(\d+)__$/);
    const assetIndex = placeholder ? Number(placeholder[1]) : placements.length;
    const before = body.slice(0, match.index);
    const afterParagraph = before.split("\n\n").filter((p) => p.trim()).length;
    const asset = getCoverAssetByIndex(coverAssets, assetIndex);
    placements.push({
      after_paragraph: afterParagraph,
      asset_index: assetIndex,
      caption: alt || asset?.caption || `配图${assetIndex + 1}`,
      prompt: asset?.prompt || "",
    });
  }
  return placements;
}

export function createEmptyAssetSlot(index: number, caption = "配图"): CoverAsset {
  return {
    id: crypto.randomUUID(),
    platform: "wechat",
    headline: caption.slice(0, 20),
    subheadline: caption,
    prompt: "待上传或 AI 生成",
    caption,
    asset_index: index,
    source: "placeholder",
  };
}
