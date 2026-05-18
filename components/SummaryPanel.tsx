import { AlertTriangle, Bot, CheckCircle2, Lightbulb, ListChecks, Newspaper, RefreshCw, Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import { Chip, GlassPanel } from "@/components/Workspace";
import { DEFAULT_SUMMARY_FORMAT, getSummaryFormatOption } from "@/lib/summarization";
import type { NewsletterSummary, SummaryFormat } from "@/lib/types";

interface SummaryPanelProps {
  summary: NewsletterSummary | null;
  preferredFormat?: SummaryFormat;
  onRetry?: () => void;
  retrying?: boolean;
}

export function SummaryPanel({ summary, preferredFormat = DEFAULT_SUMMARY_FORMAT, onRetry, retrying = false }: SummaryPanelProps) {
  if (!summary) {
    const option = getSummaryFormatOption(preferredFormat);
    return (
      <GlassPanel className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Chip tone="warn">
            <Sparkles className="h-3.5 w-3.5" />
            Awaiting AI brief
          </Chip>
          {onRetry ? <RetryButton onRetry={onRetry} retrying={retrying} label="Generate summary" /> : null}
        </div>
        <h2 className="mt-4 font-display text-2xl font-semibold tracking-[-0.04em] text-white">No summary yet</h2>
        <p className="mt-3 text-sm leading-6 text-white/56">
          Generate a {option.title.toLowerCase()} for this newsletter. The agent will use your saved format preference.
        </p>
      </GlassPanel>
    );
  }

  const keyPoints = parseJsonArray<{ point: string; importance: string }>(summary.keyPoints);
  const actionItems = parseJsonArray<{ action: string; urgency: string }>(summary.actionItems);
  const topics = parseJsonArray<string>(summary.topics);
  const format = getSummaryFormatOption(summary.format || preferredFormat);
  const source = getSummarySource(summary);

  return (
    <GlassPanel className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Chip tone="accent">
            <Sparkles className="h-3.5 w-3.5" />
            {format.title}
          </Chip>
          <Chip tone={source.tone}>
            {source.icon}
            {source.label}
          </Chip>
        </div>
        <div className="flex items-center gap-3">
          {onRetry ? <RetryButton onRetry={onRetry} retrying={retrying} label="Retry summary" /> : null}
          <span className="text-xs font-medium text-white/42">{summary.readTimeMinutes} min read</span>
        </div>
      </div>
      {source.detail ? <div className="mt-3 text-xs text-white/42">{source.detail}</div> : null}

      <h2 className="mt-5 font-display text-2xl font-semibold tracking-[-0.04em] text-white">{summary.title}</h2>
      <p className="mt-3 text-sm leading-6 text-white/65">{summary.tldr}</p>

      {renderFormatBody(summary.format || preferredFormat, keyPoints, actionItems)}

      {topics.length > 0 ? (
        <div className="mt-6 flex flex-wrap gap-2 border-t border-white/10 pt-4">
          {topics.map((topic) => (
            <Chip key={topic} tone="cyan">
              {topic}
            </Chip>
          ))}
        </div>
      ) : null}
    </GlassPanel>
  );
}

function RetryButton({ onRetry, retrying, label }: { onRetry: () => void; retrying: boolean; label: string }) {
  return (
    <button
      type="button"
      onClick={onRetry}
      disabled={retrying}
      className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-medium text-white/64 transition hover:border-[#2cd0ff]/30 hover:text-[#b1e9ff] disabled:cursor-wait disabled:opacity-55"
    >
      <RefreshCw className={`h-3.5 w-3.5 ${retrying ? "animate-spin" : ""}`} />
      {retrying ? "Regenerating..." : label}
    </button>
  );
}

function getSummarySource(summary: NewsletterSummary): {
  label: string;
  detail?: string;
  tone: "neutral" | "good" | "warn";
  icon: ReactNode;
} {
  if (summary.generationSource === "llm") {
    return {
      label: "LLM generated",
      detail: summary.generationModel ? `Generated through ${summary.generationModel}.` : undefined,
      tone: "good",
      icon: <Bot className="h-3.5 w-3.5" />,
    };
  }
  if (summary.generationSource === "fallback") {
    return {
      label: "Fallback / non-LLM",
      detail: summary.generationError ? `Fallback reason: ${summary.generationError}` : "Generated from deterministic article text fallback.",
      tone: "warn",
      icon: <AlertTriangle className="h-3.5 w-3.5" />,
    };
  }
  return {
    label: "Source unknown",
    detail: "Legacy summary created before source tracking was added. Retry to verify with the LLM.",
    tone: "neutral",
    icon: <AlertTriangle className="h-3.5 w-3.5" />,
  };
}

function renderFormatBody(
  format: SummaryFormat,
  keyPoints: Array<{ point: string; importance: string }>,
  actionItems: Array<{ action: string; urgency: string }>,
) {
  if (format === "executive_summary") {
    return (
      <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
          <Newspaper className="h-4 w-4 text-[#b1e9ff]" />
          Strategic support
        </h3>
        <ul className="mt-3 space-y-2">
          {keyPoints.slice(0, 3).map((item, index) => (
            <li key={`${item.point}-${index}`} className="text-sm leading-6 text-white/58">
              {item.point}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (format === "key_insights") {
    return (
      <div className="mt-6 space-y-3">
        {keyPoints.map((item, index) => (
          <div key={`${item.point}-${index}`} className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#cdbcff]">
              <Lightbulb className="h-4 w-4" />
              {item.importance} insight
            </div>
            <p className="mt-2 text-sm leading-6 text-white/68">{item.point}</p>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-5">
      <div>
        <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
          <ListChecks className="h-4 w-4 text-[#b1e9ff]" />
          Key points
        </h3>
        <ul className="mt-3 space-y-3">
          {keyPoints.map((item, index) => (
            <li key={`${item.point}-${index}`} className="flex gap-3 text-sm leading-6 text-white/62">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-200" />
              <span>
                <span className="font-semibold text-white/82">{item.importance}</span>: {item.point}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {actionItems.length > 0 ? (
        <div>
          <h3 className="text-sm font-semibold text-white">Action items</h3>
          <ul className="mt-3 space-y-2">
            {actionItems.map((item, index) => (
              <li key={`${item.action}-${index}`} className="text-sm leading-6 text-white/58">
                <span className="font-semibold text-white/80">{item.urgency}</span>: {item.action}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function parseJsonArray<T>(value: string): T[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
