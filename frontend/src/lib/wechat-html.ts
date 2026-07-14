import type {
  CoverAsset,
  WechatContent,
  WechatImagePlacement,
  WechatLayoutPreset,
  WechatStyleTheme,
} from "./types";
import { inlineFormat } from "./markdown";
import { getCoverAssetByIndex } from "./wechat-assets";

const DEFAULT_THEME: WechatStyleTheme = {
  layout_preset: "classic",
  accent: "#455548",
  mood: "warm",
  heading_style: "border_left",
  quote_bg: "#faf8f5",
  quote_border: "#d4a574",
  text_color: "#3f3f3f",
  heading_color: "#1a1c1b",
};

const VALID_PRESETS = new Set<WechatLayoutPreset>(["classic", "lively", "story", "checklist"]);

export const LAYOUT_PRESET_LABELS: Record<WechatLayoutPreset, string> = {
  classic: "经典",
  lively: "活泼",
  story: "故事",
  checklist: "清单",
};

function accentTint(hexColor: string, alpha = "14"): string {
  if (hexColor.startsWith("#") && hexColor.length === 7) {
    return hexColor + alpha;
  }
  return hexColor;
}

export function normalizeStyleTheme(theme?: Partial<WechatStyleTheme>): WechatStyleTheme {
  const merged = { ...DEFAULT_THEME, ...theme };
  if (!merged.layout_preset || !VALID_PRESETS.has(merged.layout_preset)) {
    merged.layout_preset = "classic";
  }
  return merged;
}

type StyleMap = {
  p: string;
  h2: string;
  h3: string;
  h4: string;
  quote: string;
  hr: string;
  hrBlock: string;
  ol: string;
  ul: string;
  li: string;
  liPrefix: string;
  summary: string;
  tip: string;
  warn: string;
  imageWrap: string;
  image: string;
  caption: string;
  accentInline: string;
};

function classicStyles(theme: WechatStyleTheme): StyleMap {
  const headingBorder =
    theme.heading_style === "border_left"
      ? `border-left:4px solid ${theme.accent};padding-left:12px;`
      : theme.heading_style === "underline"
        ? `border-bottom:2px solid ${theme.accent};padding-bottom:6px;`
        : "";
  return {
    p: `margin:0 0 16px;line-height:1.9;font-size:16px;color:${theme.text_color};text-align:justify;letter-spacing:0.02em;`,
    h2: `margin:28px 0 14px;font-size:20px;font-weight:700;color:${theme.heading_color};${headingBorder}`,
    h3: `margin:24px 0 12px;font-size:18px;font-weight:700;color:${theme.heading_color};${headingBorder}`,
    h4: `margin:20px 0 10px;font-size:16px;font-weight:700;color:${theme.heading_color};`,
    quote: `margin:16px 0;padding:12px 16px;background:${theme.quote_bg};border-left:4px solid ${theme.quote_border};color:#666;font-size:15px;line-height:1.85;`,
    hr: "margin:24px 0;border:none;border-top:1px solid #e8e4df;",
    hrBlock: "",
    ol: `margin:12px 0 20px;padding-left:24px;color:${theme.text_color};`,
    ul: `margin:12px 0 20px;padding-left:24px;color:${theme.text_color};`,
    li: "margin-bottom:10px;line-height:1.85;font-size:16px;",
    liPrefix: "",
    summary: `margin:16px 0;padding:12px 16px;background:#fffbeb;border-left:4px solid #fbbf24;color:#57534e;font-size:14px;line-height:1.75;`,
    tip: "",
    warn: "",
    imageWrap: "margin:20px 0;text-align:center;",
    image: "width:100%;max-width:100%;border-radius:8px;display:block;margin:0 auto;",
    caption: "font-size:13px;color:#999;margin-top:8px;line-height:1.5;",
    accentInline: "",
  };
}

function livelyStyles(theme: WechatStyleTheme): StyleMap {
  const tint = accentTint(theme.accent);
  return {
    p: `margin:0 0 16px;line-height:1.9;font-size:16px;color:${theme.text_color};text-align:justify;letter-spacing:0.02em;`,
    h2: `margin:28px 0 14px;font-size:20px;font-weight:700;color:${theme.heading_color};background:${tint};border-radius:8px;padding:10px 14px;`,
    h3: `margin:24px 0 12px;font-size:18px;font-weight:700;color:${theme.heading_color};background:${tint};border-radius:8px;padding:8px 12px;`,
    h4: `margin:20px 0 10px;font-size:16px;font-weight:700;color:${theme.heading_color};background:${tint};border-radius:6px;padding:6px 10px;`,
    quote: `margin:16px 0;padding:14px 18px;background:${theme.quote_bg};border-left:4px solid ${theme.quote_border};border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,0.06);color:#666;font-size:15px;line-height:1.85;`,
    hr: "margin:24px 0;border:none;border-top:1px solid #e8e4df;",
    hrBlock: "margin:24px 0;text-align:center;color:#ccc;letter-spacing:10px;font-size:18px;",
    ol: `margin:12px 0 20px;padding-left:24px;color:${theme.text_color};`,
    ul: `margin:12px 0 20px;padding-left:4px;list-style:none;color:${theme.text_color};`,
    li: "margin-bottom:10px;line-height:1.85;font-size:16px;",
    liPrefix: `color:${theme.accent};margin-right:6px;`,
    summary: `margin:16px 0;padding:12px 16px;background:${theme.quote_bg};border-left:4px solid ${theme.quote_border};border-radius:8px;color:#57534e;font-size:14px;line-height:1.75;`,
    tip: `margin:16px 0;padding:12px 16px;background:${tint};border-left:4px solid ${theme.accent};border-radius:8px;color:#444;font-size:15px;line-height:1.85;`,
    warn: "margin:16px 0;padding:12px 16px;background:#fef2f2;border-left:4px solid #f87171;border-radius:8px;color:#7f1d1d;font-size:15px;line-height:1.85;",
    imageWrap: "margin:20px 0;text-align:center;",
    image: "width:100%;max-width:100%;border-radius:8px;display:block;margin:0 auto;",
    caption: "font-size:13px;color:#999;margin-top:8px;line-height:1.5;",
    accentInline: theme.accent,
  };
}

function storyStyles(theme: WechatStyleTheme): StyleMap {
  return {
    p: `margin:0 0 18px;line-height:2.1;font-size:16px;color:${theme.text_color};text-align:left;letter-spacing:0.03em;`,
    h2: `margin:32px 0 16px;font-size:20px;font-weight:700;color:${theme.heading_color};text-align:center;border-bottom:2px solid ${theme.accent};padding-bottom:8px;`,
    h3: `margin:28px 0 14px;font-size:18px;font-weight:600;color:${theme.heading_color};text-align:center;border-bottom:1px solid ${theme.accent};padding-bottom:6px;`,
    h4: `margin:22px 0 12px;font-size:16px;font-weight:600;color:${theme.heading_color};text-align:center;`,
    quote: `margin:20px 0;padding:14px 20px;background:${theme.quote_bg};border-left:none;border-top:1px solid ${theme.quote_border};border-bottom:1px solid ${theme.quote_border};color:#666;font-size:15px;line-height:2;font-style:italic;text-align:center;`,
    hr: "margin:28px 0;border:none;border-top:1px solid #e8e4df;",
    hrBlock: "",
    ol: `margin:14px 0 22px;padding-left:24px;color:${theme.text_color};`,
    ul: `margin:14px 0 22px;padding-left:24px;color:${theme.text_color};`,
    li: "margin-bottom:12px;line-height:2;font-size:16px;",
    liPrefix: "",
    summary: `margin:16px 0;padding:14px 18px;background:${theme.quote_bg};border:none;border-radius:4px;color:#57534e;font-size:14px;line-height:1.9;text-align:center;font-style:italic;`,
    tip: "",
    warn: "",
    imageWrap: "margin:24px 0;text-align:center;",
    image: "width:100%;max-width:100%;border-radius:4px;display:block;margin:0 auto;",
    caption: "font-size:13px;color:#999;margin-top:8px;line-height:1.5;font-style:italic;",
    accentInline: "",
  };
}

function checklistStyles(theme: WechatStyleTheme): StyleMap {
  const tint = accentTint(theme.accent);
  return {
    p: `margin:0 0 12px;line-height:1.75;font-size:15px;color:${theme.text_color};text-align:left;`,
    h2: `margin:24px 0 12px;font-size:19px;font-weight:700;color:#fff;background:${theme.accent};border-radius:20px;padding:8px 16px;display:inline-block;`,
    h3: `margin:20px 0 10px;font-size:17px;font-weight:700;color:${theme.heading_color};border-left:4px solid ${theme.accent};padding-left:10px;`,
    h4: `margin:16px 0 8px;font-size:15px;font-weight:700;color:${theme.heading_color};`,
    quote: `margin:12px 0;padding:10px 14px;background:${theme.quote_bg};border-left:3px solid ${theme.quote_border};color:#555;font-size:14px;line-height:1.7;`,
    hr: "margin:16px 0;border:none;border-top:1px dashed #d6d3d1;",
    hrBlock: "",
    ol: `margin:8px 0 16px;padding-left:22px;color:${theme.text_color};`,
    ul: `margin:8px 0 16px;padding-left:22px;color:${theme.text_color};`,
    li: "margin-bottom:6px;line-height:1.75;font-size:15px;",
    liPrefix: "",
    summary: `margin:12px 0;padding:10px 14px;background:${tint};border:1px solid ${theme.accent};border-radius:6px;color:#444;font-size:14px;line-height:1.7;`,
    tip: `margin:12px 0;padding:10px 14px;background:${tint};border:1px solid ${theme.accent};border-radius:6px;color:#444;font-size:14px;line-height:1.7;`,
    warn: "margin:12px 0;padding:10px 14px;background:#fef2f2;border:1px solid #fca5a5;border-radius:6px;color:#7f1d1d;font-size:14px;line-height:1.7;",
    imageWrap: "margin:16px 0;text-align:center;",
    image: "width:100%;max-width:100%;border-radius:6px;display:block;margin:0 auto;",
    caption: "font-size:12px;color:#999;margin-top:6px;line-height:1.4;",
    accentInline: "",
  };
}

function styles(theme: WechatStyleTheme): StyleMap {
  const t = normalizeStyleTheme(theme);
  switch (t.layout_preset) {
    case "lively":
      return livelyStyles(t);
    case "story":
      return storyStyles(t);
    case "checklist":
      return checklistStyles(t);
    default:
      return classicStyles(t);
  }
}

function inlineWithAccent(text: string, accent?: string): string {
  if (!accent) return inlineFormat(text);
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
  return escaped
    .replace(/\*\*(.+?)\*\*/g, `<strong style="font-weight:600;color:${accent};">$1</strong>`)
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");
}

const IMAGE_PLACEHOLDER_RE = /^__IMAGE_(\d+)__$/;
const MARKDOWN_IMAGE_RE = /^!\[([^\]]*)\]\(([^)]+)\)$/;

function resolveImageSrc(
  src: string,
  coverAssets: CoverAsset[],
  resolveUrl: (url: string) => string,
): { url: string; caption: string } {
  const placeholder = src.match(IMAGE_PLACEHOLDER_RE);
  if (placeholder) {
    const index = Number(placeholder[1]);
    const asset = getCoverAssetByIndex(coverAssets, index);
    if (asset?.image_url && asset.source !== "placeholder") {
      return {
        url: resolveUrl(asset.image_url),
        caption: asset.caption || asset.subheadline || "",
      };
    }
    return { url: "", caption: "" };
  }
  if (src.startsWith("http") || src.startsWith("/")) {
    return { url: resolveUrl(src), caption: "" };
  }
  return { url: resolveUrl(src), caption: "" };
}

function renderImageBlock(
  alt: string,
  src: string,
  s: StyleMap,
  coverAssets: CoverAsset[],
  resolveUrl: (url: string) => string,
): string {
  const { url, caption } = resolveImageSrc(src, coverAssets, resolveUrl);
  if (!url) {
    return `<section style="${s.imageWrap}"><p style="${s.caption}">[配图：${inlineFormat(alt || "待生成")}]</p></section>`;
  }
  const cap = caption || alt;
  return [
    `<section style="${s.imageWrap}">`,
    `<img src="${url}" alt="${alt.replace(/"/g, "&quot;")}" style="${s.image}" />`,
    cap ? `<p style="${s.caption}">${inlineFormat(cap)}</p>` : "",
    "</section>",
  ].join("");
}

function renderQuoteBlock(inner: string, s: StyleMap): string {
  const stripped = inner.trim();
  if (stripped.startsWith("💡") && s.tip) {
    const text = stripped.replace(/^💡\s*/, "");
    return `<blockquote style="${s.tip}">💡 ${inlineWithAccent(text, s.accentInline || undefined)}</blockquote>`;
  }
  if (stripped.startsWith("⚠️") && s.warn) {
    const text = stripped.replace(/^⚠️\s*/, "");
    return `<blockquote style="${s.warn}">⚠️ ${inlineFormat(text)}</blockquote>`;
  }
  return `<blockquote style="${s.quote}">${inlineWithAccent(inner, s.accentInline || undefined)}</blockquote>`;
}

function renderHr(s: StyleMap): string {
  if (s.hrBlock) {
    return `<section style="${s.hrBlock}">· · ·</section>`;
  }
  return `<hr style="${s.hr}" />`;
}

function renderListItem(text: string, s: StyleMap, ordered: boolean): string {
  const formatted = inlineWithAccent(text, s.accentInline || undefined);
  if (s.liPrefix && !ordered) {
    return `<li style="${s.li}"><span style="${s.liPrefix}">●</span>${formatted}</li>`;
  }
  return `<li style="${s.li}">${formatted}</li>`;
}

export type WechatPreviewBlock =
  | { type: "markdown"; text: string }
  | { type: "image"; assetIndex: number; caption: string };

export function splitWechatPreviewBlocks(body: string): WechatPreviewBlock[] {
  const lines = body.split("\n");
  const blocks: WechatPreviewBlock[] = [];
  let buffer: string[] = [];

  function flush() {
    if (buffer.length > 0) {
      blocks.push({ type: "markdown", text: buffer.join("\n") });
      buffer = [];
    }
  }

  for (const line of lines) {
    const trimmed = line.trim();
    const imageMatch = trimmed.match(MARKDOWN_IMAGE_RE);
    const placeholderMatch = imageMatch?.[2]?.trim().match(IMAGE_PLACEHOLDER_RE);
    if (imageMatch && placeholderMatch) {
      flush();
      blocks.push({
        type: "image",
        assetIndex: Number(placeholderMatch[1]),
        caption: imageMatch[1],
      });
    } else {
      buffer.push(line);
    }
  }
  flush();
  return blocks.length > 0 ? blocks : [{ type: "markdown", text: body }];
}

export function getWechatImageStyles(theme?: Partial<WechatStyleTheme>) {
  const s = styles(normalizeStyleTheme(theme));
  return {
    imageWrap: s.imageWrap,
    image: s.image,
    caption: s.caption,
  };
}

/** 公众号正文：Markdown → inline style HTML（可直接粘贴到 mp.weixin.qq.com） */
export function renderWechatBodyInlineHtml(
  body: string,
  theme?: Partial<WechatStyleTheme>,
  coverAssets: CoverAsset[] = [],
  resolveUrl: (url: string) => string = (u) => u,
): string {
  const normalized = normalizeStyleTheme(theme);
  const s = styles(normalized);
  const lines = body.split("\n");
  const html: string[] = [];
  let inOl = false;
  let inUl = false;

  function closeLists() {
    if (inOl) {
      html.push("</ol>");
      inOl = false;
    }
    if (inUl) {
      html.push("</ul>");
      inUl = false;
    }
  }

  for (const line of lines) {
    const trimmed = line.trim();

    const imageMatch = trimmed.match(MARKDOWN_IMAGE_RE);
    if (imageMatch) {
      closeLists();
      html.push(renderImageBlock(imageMatch[1], imageMatch[2], s, coverAssets, resolveUrl));
      continue;
    }

    if (trimmed.startsWith("### ")) {
      closeLists();
      html.push(
        `<h4 style="${s.h4}">${inlineWithAccent(trimmed.slice(4), s.accentInline || undefined)}</h4>`,
      );
      continue;
    }
    if (trimmed.startsWith("## ")) {
      closeLists();
      html.push(
        `<h3 style="${s.h3}">${inlineWithAccent(trimmed.slice(3), s.accentInline || undefined)}</h3>`,
      );
      continue;
    }
    if (trimmed.startsWith("# ")) {
      closeLists();
      html.push(
        `<h2 style="${s.h2}">${inlineWithAccent(trimmed.slice(2), s.accentInline || undefined)}</h2>`,
      );
      continue;
    }
    if (trimmed.startsWith("> ")) {
      closeLists();
      html.push(renderQuoteBlock(trimmed.slice(2), s));
      continue;
    }
    if (/^(-{3,}|_{3,}|\*{3,})$/.test(trimmed)) {
      closeLists();
      html.push(renderHr(s));
      continue;
    }

    const olMatch = trimmed.match(/^(\d+)[.)]\s+(.+)$/);
    if (olMatch) {
      if (!inOl) {
        closeLists();
        html.push(`<ol style="${s.ol}">`);
        inOl = true;
      }
      html.push(renderListItem(olMatch[2], s, true));
      continue;
    }

    const ulMatch = trimmed.match(/^[-*•]\s+(.+)$/);
    if (ulMatch) {
      if (!inUl) {
        closeLists();
        html.push(`<ul style="${s.ul}">`);
        inUl = true;
      }
      html.push(renderListItem(ulMatch[1], s, false));
      continue;
    }

    if (!trimmed) {
      closeLists();
      continue;
    }

    closeLists();
    html.push(`<p style="${s.p}">${inlineWithAccent(trimmed, s.accentInline || undefined)}</p>`);
  }

  closeLists();
  return html.join("");
}

/** 完整公众号复制 HTML：摘要 + 正文（始终根据当前 body 实时渲染） */
export function renderWechatCopyHtml(
  content: WechatContent,
  coverAssets: CoverAsset[] = [],
  resolveUrl: (url: string) => string = (u) => u,
): string {
  const theme = normalizeStyleTheme(content.style_theme);
  const s = styles(theme);
  const parts: string[] = [];
  if (content.summary?.trim()) {
    parts.push(`<blockquote style="${s.summary}">${inlineFormat(content.summary)}</blockquote>`);
  }
  parts.push(renderWechatBodyInlineHtml(content.body || "", theme, coverAssets, resolveUrl));
  return parts.join("");
}

export function getWechatPlainText(content: WechatContent): string {
  return `# ${content.title}\n\n${content.summary}\n\n${content.body}`;
}

/** 复制到剪贴板：同时写入 text/html 与 text/plain */
export async function copyWechatRichHtml(
  content: WechatContent,
  coverAssets: CoverAsset[] = [],
  resolveUrl: (url: string) => string = (u) => u,
): Promise<void> {
  const html = renderWechatCopyHtml(content, coverAssets, resolveUrl);
  const plain = getWechatPlainText(content);

  if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
    const item = new ClipboardItem({
      "text/html": new Blob([html], { type: "text/html" }),
      "text/plain": new Blob([plain], { type: "text/plain" }),
    });
    await navigator.clipboard.write([item]);
    return;
  }

  await navigator.clipboard.writeText(plain);
}

export function buildFormattedHtml(
  content: WechatContent,
  coverAssets: CoverAsset[] = [],
  resolveUrl: (url: string) => string = (u) => u,
): string {
  return renderWechatCopyHtml(content, coverAssets, resolveUrl);
}

export function replaceImagePlaceholders(body: string, coverAssets: CoverAsset[]): string {
  let result = body;
  for (const asset of coverAssets) {
    if (!asset.image_url || asset.source === "placeholder") continue;
    const index = asset.asset_index ?? coverAssets.indexOf(asset);
    const placeholder = `__IMAGE_${index}__`;
    result = result.split(placeholder).join(asset.image_url);
  }
  return result;
}

export function getImagePlacementLabel(
  placement: WechatImagePlacement,
  asset?: CoverAsset,
): string {
  const pos = placement.after_paragraph;
  if (pos === 0) return "文首";
  if (pos != null && pos > 0) return `第 ${pos} 段后`;
  if (asset?.after_paragraph != null) {
    return asset.after_paragraph === 0 ? "文首" : `第 ${asset.after_paragraph} 段后`;
  }
  return "正文内";
}
