import Link from "next/link";
import { ArrowUpRight, Clock3 } from "lucide-react";
import { Chip, GlassPanel } from "@/components/Workspace";
import { DEFAULT_SUMMARY_FORMAT, getSummaryFormatOption } from "@/lib/summarization";
import type { NewsletterEmail, NewsletterSummary } from "@/lib/types";

interface NewsletterCardProps {
  newsletter: NewsletterEmail;
  summary?: NewsletterSummary | null;
}

export function NewsletterCard({ newsletter, summary }: NewsletterCardProps) {
  const format = getSummaryFormatOption(summary?.format || DEFAULT_SUMMARY_FORMAT);
  return (
    <GlassPanel className="group p-5 transition hover:-translate-y-0.5 hover:border-white/18 hover:bg-white/[0.06]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/38">
            {newsletter.senderName || newsletter.senderEmail}
          </p>
          <h3 className="mt-2 text-lg font-semibold leading-snug tracking-[-0.025em] text-white">
            <Link href={`/newsletters/${newsletter.id}`}>{summary?.title || newsletter.subject}</Link>
          </h3>
        </div>
        <Chip tone={newsletter.hasBeenSummarized ? "good" : "warn"}>
          {newsletter.hasBeenSummarized ? "Summarized" : "Needs summary"}
        </Chip>
      </div>
      <p className="mt-3 line-clamp-3 text-sm leading-6 text-white/58">
        {summary?.tldr || newsletter.bodyPlainText}
      </p>
      <div className="mt-4 flex items-center justify-between gap-4">
        <span className="inline-flex items-center gap-2 text-xs font-medium text-white/42">
          <Clock3 className="h-3.5 w-3.5" />
          {formatDate(newsletter.receivedAt)} {summary ? `- ${format.title}` : ""}
        </span>
        <Link href={`/newsletters/${newsletter.id}`} className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#b1e9ff] underline-offset-4 hover:underline">
          Open <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </GlassPanel>
  );
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(value));
}
