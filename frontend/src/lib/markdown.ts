function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function inlineFormat(text: string): string {
  return escapeHtml(text)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");
}

/** 公众号正文：Markdown → 带排版结构的 HTML */
export function renderArticleMarkdown(body: string): string {
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

    const imageMatch = trimmed.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (imageMatch) {
      closeLists();
      const alt = imageMatch[1];
      const src = imageMatch[2];
      html.push(
        `<figure class="article-figure"><img class="article-img" src="${src.replace(/"/g, "&quot;")}" alt="${alt.replace(/"/g, "&quot;")}" /><figcaption class="article-caption">${inlineFormat(alt)}</figcaption></figure>`,
      );
      continue;
    }

    if (trimmed.startsWith("### ")) {
      closeLists();
      html.push(`<h4 class="article-h4">${inlineFormat(trimmed.slice(4))}</h4>`);
      continue;
    }
    if (trimmed.startsWith("## ")) {
      closeLists();
      html.push(`<h3 class="article-h3">${inlineFormat(trimmed.slice(3))}</h3>`);
      continue;
    }
    if (trimmed.startsWith("# ")) {
      closeLists();
      html.push(`<h2 class="article-h2">${inlineFormat(trimmed.slice(2))}</h2>`);
      continue;
    }
    if (trimmed.startsWith("> ")) {
      closeLists();
      html.push(`<blockquote class="article-quote">${inlineFormat(trimmed.slice(2))}</blockquote>`);
      continue;
    }
    if (/^(-{3,}|_{3,}|\*{3,})$/.test(trimmed)) {
      closeLists();
      html.push('<hr class="article-hr" />');
      continue;
    }

    const olMatch = trimmed.match(/^(\d+)[.)]\s+(.+)$/);
    if (olMatch) {
      if (!inOl) {
        closeLists();
        html.push('<ol class="article-ol">');
        inOl = true;
      }
      html.push(`<li>${inlineFormat(olMatch[2])}</li>`);
      continue;
    }

    const ulMatch = trimmed.match(/^[-*•]\s+(.+)$/);
    if (ulMatch) {
      if (!inUl) {
        closeLists();
        html.push('<ul class="article-ul">');
        inUl = true;
      }
      html.push(`<li>${inlineFormat(ulMatch[1])}</li>`);
      continue;
    }

    if (!trimmed) {
      closeLists();
      continue;
    }

    closeLists();
    html.push(`<p class="article-p">${inlineFormat(trimmed)}</p>`);
  }

  closeLists();
  return html.join("");
}

/** 聊天消息：轻量 Markdown（段落、列表、加粗） */
export function renderChatMarkdown(body: string): string {
  const lines = body.split("\n");
  const html: string[] = [];
  let inUl = false;

  function closeUl() {
    if (inUl) {
      html.push("</ul>");
      inUl = false;
    }
  }

  for (const line of lines) {
    const trimmed = line.trim();
    const ulMatch = trimmed.match(/^[-*•]\s+(.+)$/);
    if (ulMatch) {
      if (!inUl) {
        closeUl();
        html.push('<ul class="my-1 list-disc pl-4">');
        inUl = true;
      }
      html.push(`<li>${inlineFormat(ulMatch[1])}</li>`);
      continue;
    }
    if (!trimmed) {
      closeUl();
      html.push("<br />");
      continue;
    }
    closeUl();
    if (trimmed.startsWith("### ")) {
      html.push(`<p class="my-1 font-semibold">${inlineFormat(trimmed.slice(4))}</p>`);
    } else if (trimmed.startsWith("## ")) {
      html.push(`<p class="my-1 font-semibold">${inlineFormat(trimmed.slice(3))}</p>`);
    } else if (trimmed.startsWith("# ")) {
      html.push(`<p class="my-1 font-bold">${inlineFormat(trimmed.slice(2))}</p>`);
    } else if (trimmed.startsWith("> ")) {
      html.push(
        `<blockquote class="my-1 border-l-2 border-outline-variant/40 pl-2 text-on-surface-variant">${inlineFormat(trimmed.slice(2))}</blockquote>`,
      );
    } else {
      html.push(`<p class="my-0.5">${inlineFormat(trimmed)}</p>`);
    }
  }
  closeUl();
  return html.join("");
}

export function renderXhsBody(body: string): string {
  const blocks = body.split(/\n{2,}/).filter((block) => block.trim());
  if (blocks.length === 0) {
    return `<p class="xhs-para">${inlineFormat(body || "正文待生成")}</p>`;
  }

  return blocks
    .map((block) => {
      const lines = block.split("\n").filter((line) => line.trim());
      const content = lines.map((line) => inlineFormat(line.trim())).join("<br />");
      return `<p class="xhs-para">${content}</p>`;
    })
    .join("");
}
