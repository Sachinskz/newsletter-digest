"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CheckCircle2, CircleDot, Filter, Inbox } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { SyncButton } from "@/components/SyncButton";
import { Chip, GlassPanel, PageHeader } from "@/components/Workspace";
import type { NewsletterEmail } from "@/lib/types";

type SummaryFilter = "all" | "summarized" | "unsummarized";

export default function NewslettersPage() {
  const [newsletters, setNewsletters] = useState<NewsletterEmail[]>([]);
  const [filter, setFilter] = useState<SummaryFilter>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadNewsletters(nextFilter = filter) {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (nextFilter !== "all") params.set("summaryStatus", nextFilter);
      const res = await fetch(`/api/newsletters${params.size ? `?${params}` : ""}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not load newsletters");
      setNewsletters(data.newsletters || []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load newsletters");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadNewsletters(filter);
  }, [filter]);

  return (
    <div className="fade-lift">
      <PageHeader
        eyebrow="Newsletter Inbox"
        title="All synced newsletter sources."
        description="Every stored item is deduped by Microsoft Graph message id and kept as normalized text in Busibox data-api."
        action={<SyncButton onSynced={() => loadNewsletters(filter)} />}
      />

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Chip tone="neutral">
          <Filter className="h-3.5 w-3.5" />
          Filter
        </Chip>
        {(["all", "unsummarized", "summarized"] as SummaryFilter[]).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setFilter(item)}
            className={`rounded-full border px-4 py-2 text-xs font-semibold capitalize transition ${
              filter === item
                ? "border-[#7c5cff]/60 bg-[#7c5cff]/18 text-white"
                : "border-white/10 bg-white/[0.035] text-white/54 hover:border-white/18 hover:text-white"
            }`}
          >
            {item}
          </button>
        ))}
      </div>

      {error ? <div className="mt-6 rounded-2xl border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-100">{error}</div> : null}

      <GlassPanel className="mt-6 overflow-hidden">
        {loading ? (
          <div className="p-8 text-sm text-white/55">Loading newsletters...</div>
        ) : newsletters.length > 0 ? (
          <div className="divide-y divide-white/10">
            {newsletters.map((newsletter) => (
              <Link
                key={newsletter.id}
                href={`/newsletters/${newsletter.id}`}
                className="grid gap-4 p-5 transition hover:bg-white/[0.035] md:grid-cols-[1fr_190px_150px]"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    {newsletter.hasBeenSummarized ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                    ) : (
                      <CircleDot className="h-4 w-4 text-amber-200" />
                    )}
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/38">
                      {newsletter.senderName || newsletter.senderEmail}
                    </p>
                  </div>
                  <h2 className="mt-2 text-lg font-semibold tracking-[-0.03em] text-white">{newsletter.subject}</h2>
                  <p className="mt-2 line-clamp-2 text-sm leading-6 text-white/55">{newsletter.bodyPlainText}</p>
                </div>
                <div className="text-sm text-white/42 md:text-right">{newsletter.senderEmail}</div>
                <div className="text-sm font-semibold text-white/62 md:text-right">
                  {new Date(newsletter.receivedAt).toLocaleDateString()}
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="p-8">
            <EmptyState
              icon={Inbox}
              title="No newsletters match this view"
              description="Try a different filter, or connect Microsoft 365 once OAuth setup is available."
            />
          </div>
        )}
      </GlassPanel>
    </div>
  );
}
