import type {
  TrendAnalysis,
  TrendInspirationSnapshot,
  TrendItem,
  WechatInspirationPick,
  DouyinInspirationPick,
} from "@/lib/types";

export function analysisFromDouyinPick(pick: DouyinInspirationPick): TrendAnalysis {
  return {
    why_hot: `栏目：${pick.pillar}，表达类型：${pick.expression_type}。`,
    account_angle: pick.douyin.opening || pick.hook,
    topic_ideas: [pick.xiaohongshu.title || pick.title],
    platform_tips: {
      wechat: "",
      xiaohongshu: pick.xiaohongshu.methods.join("；") || pick.xiaohongshu.opening,
      douyin: pick.copy_text.slice(0, 200),
    },
    caution: "",
    related: [],
  };
}

export function snapshotFromDouyinPick(
  pick: DouyinInspirationPick,
  analysis: TrendAnalysis,
): TrendInspirationSnapshot {
  return {
    trend_id: pick.trend_id,
    title: pick.title,
    source_label: pick.pillar || pick.source_label,
    summary: pick.douyin.opening || pick.hook,
    url: pick.url,
    analysis,
  };
}

export function analysisFromPick(pick: WechatInspirationPick): TrendAnalysis {
  return {
    why_hot: `热度 ${pick.heat}，来源 ${pick.source_label}。`,
    account_angle: pick.angle,
    topic_ideas: [pick.article_title],
    platform_tips: {
      wechat: "优先用推荐标题发搜索型长文，单篇只讲一个可执行问题。",
      xiaohongshu: "",
      douyin: "",
    },
    caution: "",
    related: [],
  };
}

export function buildTrendSnapshot(
  item: Pick<TrendItem, "id" | "title" | "source_label" | "summary" | "url">,
  analysis: TrendAnalysis,
): TrendInspirationSnapshot {
  return {
    trend_id: item.id,
    title: item.title,
    source_label: item.source_label,
    summary: item.summary,
    url: item.url,
    analysis,
  };
}

export function snapshotFromPick(
  pick: WechatInspirationPick,
  analysis: TrendAnalysis,
): TrendInspirationSnapshot {
  return {
    trend_id: pick.trend_id,
    title: pick.title,
    source_label: pick.source_label,
    summary: pick.angle,
    url: pick.url,
    analysis,
  };
}

export function inspirationPreviewFromSnapshot(snapshot: TrendInspirationSnapshot): string {
  const lines = [
    `【${snapshot.source_label || "热点"}】${snapshot.title}`,
    snapshot.summary,
    snapshot.analysis.why_hot ? `为什么有流量：${snapshot.analysis.why_hot}` : "",
    snapshot.analysis.account_angle ? `新号怎么跟：${snapshot.analysis.account_angle}` : "",
    snapshot.url ? `链接：${snapshot.url}` : "",
  ];
  return lines.filter(Boolean).join("\n");
}

export function topicDisplayTitle(topic: {
  title: string;
  trend_snapshot?: TrendInspirationSnapshot | null;
}): string {
  const snapshotTitle = topic.trend_snapshot?.title?.trim();
  if (!snapshotTitle) return topic.title;
  if (
    topic.title.length > 48 ||
    topic.title.includes("【公众号") ||
    topic.title.includes("原热点：")
  ) {
    return snapshotTitle;
  }
  return topic.title;
}
