import type { Topic, TopicSourceType } from "@/lib/types";

export const topicSourceLabels: Record<TopicSourceType, string> = {
  direct: "直接创建",
  manual: "手动录入",
  screenshot: "截图",
  link: "网页剪藏",
  trend: "热点工具",
};

export const topicSourceFilterOptions: Array<{
  key: "全部" | TopicSourceType;
  label: string;
}> = [
  { key: "全部", label: "全部来源" },
  { key: "direct", label: "直接创建" },
  { key: "manual", label: "手动录入" },
  { key: "screenshot", label: "截图" },
  { key: "link", label: "网页剪藏" },
  { key: "trend", label: "热点工具" },
];

export function resolveTopicSourceType(topic: Topic): TopicSourceType {
  if (topic.source_type) return topic.source_type;
  if (topic.trend_snapshot?.trend_id) return "trend";
  return "direct";
}
