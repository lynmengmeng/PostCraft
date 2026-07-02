"use client";

import { Fragment, useCallback, useEffect, useRef, useState, type ReactNode } from "react";

export type ResizablePanel = {
  id: string;
  defaultPercent: number;
  minPercent?: number;
  hidden?: boolean;
  content: ReactNode;
};

type ResizableColumnsProps = {
  panels: ResizablePanel[];
  handleWidth?: number;
  className?: string;
};

const DEFAULT_HANDLE_WIDTH = 32;

function defaultRatios(panels: ResizablePanel[]): number[] {
  return panels.map((p) => p.defaultPercent);
}

function normalizeRatios(values: number[]): number[] {
  const total = values.reduce((sum, v) => sum + v, 0);
  if (total <= 0) {
    const even = 100 / values.length;
    return values.map(() => even);
  }
  return values.map((v) => (v / total) * 100);
}

function buildGridTemplate(ratios: number[], handleWidth: number, handles: number): string {
  return ratios
    .flatMap((ratio, index) => {
      const panelCol = `${ratio}fr`;
      if (index < handles) {
        return [panelCol, `${handleWidth}px`];
      }
      return [panelCol];
    })
    .join(" ");
}

export function ResizableColumns({
  panels,
  handleWidth = DEFAULT_HANDLE_WIDTH,
  className = "",
}: ResizableColumnsProps) {
  const visiblePanels = panels.filter((p) => !p.hidden);
  const containerRef = useRef<HTMLDivElement>(null);
  const visiblePanelsRef = useRef(visiblePanels);
  visiblePanelsRef.current = visiblePanels;

  const dragRef = useRef<{ index: number; startX: number; startRatios: number[] } | null>(null);

  const panelKey = visiblePanels.map((p) => p.id).join("|");

  const [ratios, setRatios] = useState<number[]>(() => defaultRatios(visiblePanels));

  useEffect(() => {
    setRatios(defaultRatios(visiblePanels));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panelKey]);

  const syncRatios =
    ratios.length === visiblePanels.length ? ratios : defaultRatios(visiblePanels);
  const normalized = normalizeRatios(syncRatios);
  const handles = visiblePanels.length - 1;

  const onPointerMove = useCallback(
    (event: PointerEvent) => {
      const drag = dragRef.current;
      const container = containerRef.current;
      const panelsNow = visiblePanelsRef.current;
      if (!drag || !container) return;

      const rect = container.getBoundingClientRect();
      const handleCount = panelsNow.length - 1;
      const contentWidth = rect.width - handleCount * handleWidth;
      if (contentWidth <= 0) return;

      const deltaPercent = ((event.clientX - drag.startX) / contentWidth) * 100;
      const percents = normalizeRatios(drag.startRatios);
      const left = panelsNow[drag.index];
      const right = panelsNow[drag.index + 1];
      const leftMin = left.minPercent ?? 12;
      const rightMin = right.minPercent ?? 12;

      const nextPercents = [...percents];
      let leftWidth = nextPercents[drag.index] + deltaPercent;
      let rightWidth = nextPercents[drag.index + 1] - deltaPercent;

      if (leftWidth < leftMin) {
        rightWidth -= leftMin - leftWidth;
        leftWidth = leftMin;
      }
      if (rightWidth < rightMin) {
        leftWidth -= rightMin - rightWidth;
        rightWidth = rightMin;
      }

      nextPercents[drag.index] = Math.max(leftMin, leftWidth);
      nextPercents[drag.index + 1] = Math.max(rightMin, rightWidth);

      setRatios(normalizeRatios(nextPercents));
    },
    [handleWidth],
  );

  const onPointerUp = useCallback(() => {
    dragRef.current = null;
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
  }, [onPointerMove]);

  useEffect(() => {
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [onPointerMove, onPointerUp]);

  function startDrag(index: number, event: React.PointerEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      index,
      startX: event.clientX,
      startRatios: normalizeRatios(syncRatios),
    };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  }

  if (visiblePanels.length === 0) return null;

  return (
    <div
      ref={containerRef}
      className={`grid min-h-0 flex-1 overflow-hidden ${className}`}
      style={{ gridTemplateColumns: buildGridTemplate(normalized, handleWidth, handles) }}
    >
      {visiblePanels.map((panel, index) => (
        <Fragment key={panel.id}>
          <div className="flex min-h-0 min-w-0 flex-col overflow-hidden">{panel.content}</div>
          {index < handles && (
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label="调整栏宽"
              aria-valuemin={panel.minPercent ?? 12}
              aria-valuemax={100 - (visiblePanels[index + 1].minPercent ?? 12)}
              tabIndex={0}
              onPointerDown={(event) => startDrag(index, event)}
              onKeyDown={(event) => {
                const step = event.shiftKey ? 5 : 2;
                if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
                  event.preventDefault();
                  const direction = event.key === "ArrowLeft" ? -1 : 1;
                  setRatios((current) => {
                    const base =
                      current.length === visiblePanels.length
                        ? current
                        : defaultRatios(visiblePanels);
                    const percents = normalizeRatios(base);
                    const leftMin = visiblePanels[index].minPercent ?? 12;
                    const rightMin = visiblePanels[index + 1].minPercent ?? 12;
                    const next = [...percents];
                    next[index] = Math.max(leftMin, next[index] + direction * step);
                    next[index + 1] = Math.max(rightMin, next[index + 1] - direction * step);
                    return normalizeRatios(next);
                  });
                }
              }}
              className="group relative z-20 min-h-0 cursor-col-resize touch-none select-none"
            >
              <div className="pointer-events-none absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-transparent transition-colors group-hover:bg-primary/40 group-active:bg-primary/60" />
              <div className="pointer-events-none absolute inset-y-1/4 left-1/2 flex -translate-x-1/2 flex-col items-center justify-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                <span className="h-1 w-1 rounded-full bg-outline-variant/60" />
                <span className="h-1 w-1 rounded-full bg-outline-variant/60" />
                <span className="h-1 w-1 rounded-full bg-outline-variant/60" />
              </div>
            </div>
          )}
        </Fragment>
      ))}
    </div>
  );
}
