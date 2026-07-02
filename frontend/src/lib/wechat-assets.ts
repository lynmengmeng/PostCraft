import type { ContentProject, CoverAsset } from "./types";

const IMAGE_MD_RE = /!\[([^\]]*)\]\(([^)]+)\)/g;

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
    const asset = coverAssets.find((a) => (a.asset_index ?? 0) === assetIndex);
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
    source: "upload",
  };
}
