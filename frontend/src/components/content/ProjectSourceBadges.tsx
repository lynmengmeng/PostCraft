"use client";

import type { KeyboardEvent, MouseEvent } from "react";
import { useRouter } from "next/navigation";
import type { ContentProject } from "@/lib/types";
import {
  projectSourceBadgeClass,
  projectSourceLabels,
  resolveProjectSourceType,
} from "@/lib/project-source";

interface ProjectSourceBadgesProps {
  project: ContentProject;
  showTopicLink?: boolean;
}

export function ProjectSourceBadges({ project, showTopicLink = true }: ProjectSourceBadgesProps) {
  const router = useRouter();
  const source = resolveProjectSourceType(project);
  const topicLabel = project.topic_title?.trim();

  function openTopics(e: MouseEvent | KeyboardEvent) {
    e.preventDefault();
    e.stopPropagation();
    router.push("/topics");
  }

  return (
    <>
      <span
        className={`rounded px-2 py-0.5 text-[11px] font-bold uppercase tracking-tighter ${projectSourceBadgeClass(source)}`}
      >
        {projectSourceLabels[source]}
      </span>
      {showTopicLink && project.topic_id && topicLabel && (
        <span
          role="link"
          tabIndex={0}
          onClick={openTopics}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") openTopics(e);
          }}
          className="cursor-pointer rounded bg-surface-container px-2 py-0.5 text-[11px] font-semibold text-primary hover:underline"
          title="在选题库查看"
        >
          选题 · {topicLabel.length > 16 ? `${topicLabel.slice(0, 16)}…` : topicLabel}
        </span>
      )}
    </>
  );
}
