import type { ContentProject, Platform } from "@/lib/types";
import { platformLabels } from "@/lib/api";

export function WechatPreview({ content }: { content: ContentProject["platforms"]["wechat"] }) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
      <div className="mb-4 text-xs uppercase tracking-wide text-stone-400">公众号预览</div>
      <h2 className="text-2xl font-bold leading-snug">{content.title || "标题待生成"}</h2>
      <p className="mt-3 text-sm text-stone-500">{content.summary || "摘要待生成"}</p>
      <div className="prose prose-stone mt-6 max-w-none whitespace-pre-wrap text-[15px] leading-8">
        {content.body || "正文待生成"}
      </div>
    </div>
  );
}

export function XiaohongshuPreview({
  content,
}: {
  content: ContentProject["platforms"]["xiaohongshu"];
}) {
  return (
    <div className="mx-auto max-w-sm rounded-3xl border border-stone-200 bg-white p-4 shadow-sm">
      <div className="mb-3 aspect-[3/4] rounded-2xl bg-gradient-to-br from-amber-100 to-orange-200 p-4">
        <div className="text-xs text-stone-600">封面占位</div>
        <div className="mt-8 text-lg font-semibold leading-snug text-stone-800">
          {content.title || "笔记标题"}
        </div>
      </div>
      <div className="whitespace-pre-wrap text-sm leading-7 text-stone-700">
        {content.body || "正文待生成"}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {(content.tags || []).map((tag) => (
          <span key={tag} className="rounded-full bg-rose-50 px-2 py-1 text-xs text-rose-600">
            #{tag}
          </span>
        ))}
      </div>
    </div>
  );
}

export function DouyinPreview({ content }: { content: ContentProject["platforms"]["douyin"] }) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
      <div className="mb-4 text-xs uppercase tracking-wide text-stone-400">抖音口播预览</div>
      <div className="rounded-xl bg-stone-900 p-4 text-white">
        <div className="text-xs text-stone-400">3 秒钩子</div>
        <div className="mt-1 text-lg font-semibold">{content.hook || "钩子待生成"}</div>
        <div className="mt-2 text-xs text-stone-400">时长 {content.duration || "90s"}</div>
      </div>
      <div className="mt-4 overflow-hidden rounded-xl border border-stone-200">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-stone-100 text-stone-600">
            <tr>
              <th className="px-3 py-2">镜号</th>
              <th className="px-3 py-2">口播</th>
              <th className="px-3 py-2">画面</th>
            </tr>
          </thead>
          <tbody>
            {(content.script || []).map((scene) => (
              <tr key={scene.index} className="border-t border-stone-100">
                <td className="px-3 py-3 align-top">{scene.index}</td>
                <td className="px-3 py-3 align-top whitespace-pre-wrap">{scene.narration}</td>
                <td className="px-3 py-3 align-top text-stone-500">{scene.visual}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function PreviewPanel({
  project,
  platform,
}: {
  project: ContentProject;
  platform: Platform;
}) {
  if (platform === "wechat") {
    return <WechatPreview content={project.platforms.wechat} />;
  }
  if (platform === "xiaohongshu") {
    return <XiaohongshuPreview content={project.platforms.xiaohongshu} />;
  }
  return <DouyinPreview content={project.platforms.douyin} />;
}

export function getPlatformCopyText(project: ContentProject, platform: Platform): string {
  if (platform === "wechat") {
    const c = project.platforms.wechat;
    return `# ${c.title}\n\n${c.summary}\n\n${c.body}`;
  }
  if (platform === "xiaohongshu") {
    const c = project.platforms.xiaohongshu;
    return `${c.title}\n\n${c.body}\n\n${c.tags.map((t) => `#${t}`).join(" ")}`;
  }
  const c = project.platforms.douyin;
  return [
    `钩子：${c.hook}`,
    `时长：${c.duration}`,
    ...c.script.map((s) => `${s.index}. [${s.duration}] ${s.narration}`),
  ].join("\n");
}

export { platformLabels };
