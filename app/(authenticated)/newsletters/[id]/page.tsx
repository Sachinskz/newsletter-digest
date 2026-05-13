"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, FileText, Sparkles } from "lucide-react";
import { SummaryPanel } from "@/components/SummaryPanel";
import { Chip, GlassPanel } from "@/components/Workspace";
import { DEFAULT_SUMMARY_FORMAT } from "@/lib/summarization";
import type { NewsletterEmail, NewsletterSummary, SummaryFormat } from "@/lib/types";

export default function NewsletterDetailPage() {
  const params = useParams<{ id: string }>();
  const [newsletter, setNewsletter] = useState<NewsletterEmail | null>(null);
  const [summary, setSummary] = useState<NewsletterSummary | null>(null);
  const [preferredFormat, setPreferredFormat] = useState<SummaryFormat>(DEFAULT_SUMMARY_FORMAT);
  const [loading, setLoading] = useState(true);
  const [summarizing, setSummarizing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadNewsletter() {
    setError(null);
    try {
      const [newsletterRes, preferencesRes] = await Promise.all([
        fetch(`/api/newsletters/${params.id}`),
        fetch("/api/preferences"),
      ]);
      const newsletterData = await newsletterRes.json();
      const preferencesData = await preferencesRes.json();
      if (!newsletterRes.ok) throw new Error(newsletterData.error || "Could not load newsletter");
      if (!preferencesRes.ok) throw new Error(preferencesData.error || "Could not load preferences");
      setNewsletter(newsletterData.newsletter);
      setSummary(newsletterData.summary || null);
      setPreferredFormat(preferencesData.summaryFormat || DEFAULT_SUMMARY_FORMAT);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load newsletter");
    } finally {
      setLoading(false);
    }
  }

  async function summarizeNewsletter() {
    setSummarizing(true);
    setError(null);
    try {
      const res = await fetch(`/api/newsletters/${params.id}/summarize`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not summarize newsletter");
      setSummary(data.summary);
      setNewsletter((current) =>
        current ? { ...current, hasBeenSummarized: true, summaryId: data.summary.id } : current,
      );
    } catch (summarizeError) {
      setError(summarizeError instanceof Error ? summarizeError.message : "Could not summarize newsletter");
    } finally {
      setSummarizing(false);
    }
  }

  useEffect(() => {
    void loadNewsletter();
  }, [params.id]);

  return (
    <div className="fade-lift pt-24 lg:pt-2">
      <Link href="/newsletters" className="inline-flex items-center gap-2 text-sm font-semibold text-[#b1e9ff] underline-offset-4 hover:underline">
        <ArrowLeft className="h-4 w-4" />
        Back to newsletters
      </Link>

      {error ? <div className="mt-6 rounded-2xl border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-100">{error}</div> : null}

      {loading ? (
        <GlassPanel className="mt-8 p-8 text-sm text-white/55">Loading newsletter...</GlassPanel>
      ) : newsletter ? (
        <>
          <div className="mt-8 flex flex-col justify-between gap-5 border-b border-white/10 pb-6 md:flex-row md:items-end">
            <div>
              <Chip tone="cyan">{newsletter.senderName || newsletter.senderEmail}</Chip>
              <h1 className="mt-4 max-w-5xl font-display text-4xl font-semibold tracking-[-0.055em] text-white sm:text-5xl">
                {newsletter.subject}
              </h1>
              <p className="mt-3 text-sm text-white/42">
                {newsletter.senderEmail} - {new Date(newsletter.receivedAt).toLocaleString()}
              </p>
            </div>
            <button
              type="button"
              onClick={summarizeNewsletter}
              disabled={summarizing || Boolean(summary)}
              className="workspace-btn h-10 justify-center bg-[#7c5cff]/22 text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Sparkles className="h-4 w-4" />
              {summary ? "Summary saved" : summarizing ? "Summarizing" : "Generate summary"}
            </button>
          </div>

          <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1fr)_430px]">
            <GlassPanel className="p-6">
              <div className="mb-5 flex items-center justify-between gap-3">
                <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.2em] text-white/42">
                  <FileText className="h-4 w-4" />
                  Original text
                </h2>
                <span className="text-xs text-white/38">{newsletter.bodyLengthChars.toLocaleString()} chars</span>
              </div>
              <div className="max-h-[70vh] overflow-auto whitespace-pre-wrap pr-2 text-sm leading-7 text-white/66">
                {newsletter.bodyPlainText}
              </div>
            </GlassPanel>

            <div className="xl:sticky xl:top-6 xl:self-start">
              <SummaryPanel summary={summary} preferredFormat={preferredFormat} />
            </div>
          </div>
        </>
      ) : (
        <GlassPanel className="mt-8 p-8 text-sm text-white/55">Newsletter not found.</GlassPanel>
      )}
    </div>
  );
}
