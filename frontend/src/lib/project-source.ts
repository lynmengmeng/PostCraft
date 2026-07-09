import type { ContentProject, ProjectSourceType } from "@/lib/types";

export const projectSourceLabels: Record<ProjectSourceType, string> = {
  direct: "直接创建",
  topic: "来自选题",
  inspiration: "来自灵感",
  trend: "热点选题",
};

export function resolveProjectSourceType(project: ContentProject): ProjectSourceType {
  if (project.source_type) return project.source_type;
  if (project.topic_id) return "topic";
  if (project.trend_snapshot?.analysis?.why_hot) return "trend";
  return "direct";
}

export function projectSourceBadgeClass(source: ProjectSourceType): string {
  switch (source) {
    case "trend":
      return "bg-primary/10 text-primary";
    case "topic":
      return "bg-secondary-container/50 text-on-surface-variant";
    case "inspiration":
      return "bg-tertiary-container/40 text-on-surface-variant";
    default:
      return "bg-on-surface-variant/5 text-on-surface-variant";
  }
}
