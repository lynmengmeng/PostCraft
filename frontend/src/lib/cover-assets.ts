import type { ContentProject, CoverAsset, Platform, XiaohongshuImagePage } from "./types";

export function wechatCoverAssets(assets: CoverAsset[]): CoverAsset[] {
  return assets.filter((a) => a.platform === "wechat" || a.platform === "all");
}

export function xiaohongshuCarouselAssets(assets: CoverAsset[]): CoverAsset[] {
  return assets
    .filter((a) => a.platform === "xiaohongshu")
    .sort((a, b) => (a.after_paragraph ?? 0) - (b.after_paragraph ?? 0));
}

export function coverAssetsForTab(
  assets: CoverAsset[],
  editorTab: Platform | "draft",
): CoverAsset[] {
  if (editorTab === "xiaohongshu") return xiaohongshuCarouselAssets(assets);
  if (editorTab === "wechat") return wechatCoverAssets(assets);
  return assets;
}

export function xiaohongshuCarouselLabel(
  asset: CoverAsset,
  index: number,
  imagePages?: XiaohongshuImagePage[],
): string {
  const slot = asset.after_paragraph ?? index;
  const totalPages = imagePages?.length ?? 0;
  const page = imagePages?.find((p) => p.page === slot + 1) ?? imagePages?.[slot];
  if (page?.role === "cover" || slot === 0) {
    return totalPages === 1 ? "笔记配图" : "轮播封面";
  }
  if (page?.role === "summary") return "轮播总结页";
  return `轮播第 ${slot + 1} 张`;
}

export function hasXiaohongshuCarouselPlan(project: ContentProject): boolean {
  return (
    xiaohongshuCarouselAssets(project.cover_assets).length > 0 ||
    (project.platforms.xiaohongshu.image_pages?.length ?? 0) > 0 ||
    !!project.platforms.xiaohongshu.body
  );
}
