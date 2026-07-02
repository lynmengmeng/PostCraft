import type { CoverAsset, WechatContent, WechatImagePlacement, WechatStyleTheme } from "./types";
import { inlineFormat } from "./markdown";

const DEFAULT_THEME: WechatStyleTheme = {
  accent: "#455548",
  mood: "warm",
  heading_style: "border_left",
  quote_bg: "#faf8f5",
  quote_border: "#d4a574",
  text_color: "#3f3f3f",
  heading_color: "#1a1c1b",
};

export function normalizeStyleTheme(theme?: Partial<WechatStyleTheme>): WechatStyleTheme {
  return { ...DEFAULT_THEME, ...theme };
}

function styles(theme: WechatStyleTheme) {
  const t = normalizeStyleTheme(theme);
  const headingBorder =
    t.heading_style === "border_left"
      ? `border-left:4px solid ${t.accent};padding-left:12px;`
      : t.heading_style === "underline"
        ? `border-bottom:2px solid ${t.accent};padding-bottom:6px;`
        : "";
  return {
    p: `margin:0 0 16px;line-height:1.9;font-size:16px;color:${t.text_color};text-align:justify;letter-spacing:0.02em;`,
    h2: `margin:28px 0 14px;font-size:20px;font-weight:700;color:${t.heading_color};${headingBorder}`,
    h3: `margin:24px 0 12px;font-size:18px;font-weight:700;color:${t.heading_color};${headingBorder}`,
    h4: `margin:20px 0 10px;font-size:16px;font-weight:700;color:${t.heading_color};`,
    quote: `margin:16px 0;padding:12px 16px;background:${t.quote_bg};border-left:4px solid ${t.quote_border};color:#666;font-size:15px;line-height:1.85;`,
    hr: "margin:24px 0;border:none;border-top:1px solid #e8e4df;",
    ol: "margin:12px 0 20px;padding-left:24px;color:" + t.text_color + ";",
    ul: "margin:12px 0 20px;padding-left:24px;color:" + t.text_color + ";",
    li: "margin-bottom:10px;line-height:1.85;font-size:16px;",
    strong: `font-weight:600;color:${t.heading_color};`,
    summary: `margin:16px 0;padding:12px 16px;background:#fffbeb;border-left:4px solid #fbbf24;color:#57534e;font-size:14px;line-height:1.75;`,
    imageWrap: "margin:20px 0;text-align:center;",
    image: "width:100%;max-width:100%;border-radius:8px;display:block;margin:0 auto;",
    caption: "font-size:13px;color:#999;margin-top:8px;line-height:1.5;",
  };
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
    const asset = coverAssets[index];
    if (asset?.image_url) {
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
  s: ReturnType<typeof styles>,
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

/** 公众号正文：Markdown → inline style HTML（可直接粘贴到 mp.weixin.qq.com） */
export function renderWechatBodyInlineHtml(
  body: string,
  theme?: Partial<WechatStyleTheme>,
  coverAssets: CoverAsset[] = [],
  resolveUrl: (url: string) => string = (u) => u,
): string {
  const s = styles(normalizeStyleTheme(theme));
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
      html.push(`<h4 style="${s.h4}">${inlineFormat(trimmed.slice(4))}</h4>`);
      continue;
    }
    if (trimmed.startsWith("## ")) {
      closeLists();
      html.push(`<h3 style="${s.h3}">${inlineFormat(trimmed.slice(3))}</h3>`);
      continue;
    }
    if (trimmed.startsWith("# ")) {
      closeLists();
      html.push(`<h2 style="${s.h2}">${inlineFormat(trimmed.slice(2))}</h2>`);
      continue;
    }
    if (trimmed.startsWith("> ")) {
      closeLists();
      html.push(`<blockquote style="${s.quote}">${inlineFormat(trimmed.slice(2))}</blockquote>`);
      continue;
    }
    if (/^(-{3,}|_{3,}|\*{3,})$/.test(trimmed)) {
      closeLists();
      html.push(`<hr style="${s.hr}" />`);
      continue;
    }

    const olMatch = trimmed.match(/^(\d+)[.)]\s+(.+)$/);
    if (olMatch) {
      if (!inOl) {
        closeLists();
        html.push(`<ol style="${s.ol}">`);
        inOl = true;
      }
      html.push(`<li style="${s.li}">${inlineFormat(olMatch[2])}</li>`);
      continue;
    }

    const ulMatch = trimmed.match(/^[-*•]\s+(.+)$/);
    if (ulMatch) {
      if (!inUl) {
        closeLists();
        html.push(`<ul style="${s.ul}">`);
        inUl = true;
      }
      html.push(`<li style="${s.li}">${inlineFormat(ulMatch[1])}</li>`);
      continue;
    }

    if (!trimmed) {
      closeLists();
      continue;
    }

    closeLists();
    html.push(`<p style="${s.p}">${inlineFormat(trimmed)}</p>`);
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
  parts.push(
    renderWechatBodyInlineHtml(content.body || "", theme, coverAssets, resolveUrl),
  );
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

export function replaceImagePlaceholders(
  body: string,
  coverAssets: CoverAsset[],
): string {
  let result = body;
  coverAssets.forEach((asset, index) => {
    if (!asset.image_url) return;
    const placeholder = `__IMAGE_${index}__`;
    result = result.split(placeholder).join(asset.image_url);
  });
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
