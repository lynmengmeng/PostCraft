const STORAGE_KEY = "postcraft_trial_metrics";

export interface MetricEvent {
  name: string;
  props: Record<string, unknown>;
  at: string;
}

export function trackEvent(name: string, props: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const events: MetricEvent[] = raw ? (JSON.parse(raw) as MetricEvent[]) : [];
    events.push({ name, props, at: new Date().toISOString() });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(events.slice(-500)));
  } catch {
    // ignore quota / parse errors
  }
}

export function getLocalMetrics(): MetricEvent[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as MetricEvent[]) : [];
  } catch {
    return [];
  }
}
