"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { ComponentType } from "react";
import {
  Bolt,
  BriefcaseBusiness,
  ChevronRight,
  CirclePlus,
  FileText,
  Inbox,
  Linkedin,
  Mail,
  MessageSquareText,
  RefreshCw,
  Sparkles,
  Tags,
  TrendingUp,
} from "lucide-react";
import { DEFAULT_SUMMARY_FORMAT, getSummaryFormatOption } from "@/lib/summarization";
import type { NewsletterEmail, NewsletterPreferences, NewsletterSummary, SummaryFormat } from "@/lib/types";

interface ConnectionResponse {
  connected: boolean;
  accountEmail?: string;
  accountName?: string;
  status?: string;
  lastSyncAt?: string;
}

interface PreferencesResponse {
  preferences: NewsletterPreferences | null;
  hasPreferences: boolean;
  summaryFormat: SummaryFormat;
}

interface DashboardArticle {
  id: string;
  title: string;
  source: string;
  category: string;
  why: string;
  preview: string;
  importance: number;
  savedFormat?: string;
  href: string;
}

export default function DigestPage() {
  const [connection, setConnection] = useState<ConnectionResponse | null>(null);
  const [preferences, setPreferences] = useState<PreferencesResponse | null>(null);
  const [newsletters, setNewsletters] = useState<NewsletterEmail[]>([]);
  const [summaries, setSummaries] = useState<NewsletterSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadDashboard() {
    setError(null);
    try {
      const [statusRes, preferencesRes, newslettersRes, summariesRes] = await Promise.all([
        fetch("/api/oauth/status"),
        fetch("/api/preferences"),
        fetch("/api/newsletters"),
        fetch("/api/summaries"),
      ]);

      const statusData = await statusRes.json();
      const preferencesData = await preferencesRes.json();
      const newslettersData = await newslettersRes.json();
      const summariesData = await summariesRes.json();

      if (!statusRes.ok) throw new Error(statusData.error || "Could not load connection status");
      if (!preferencesRes.ok) throw new Error(preferencesData.error || "Could not load preferences");
      if (!newslettersRes.ok) throw new Error(newslettersData.error || "Could not load newsletters");
      if (!summariesRes.ok) throw new Error(summariesData.error || "Could not load summaries");

      setConnection(statusData);
      setPreferences(preferencesData);
      setNewsletters(newslettersData.newsletters || []);
      setSummaries(summariesData.summaries || []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Dashboard failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadDashboard();
  }, []);

  const summaryByEmailId = useMemo(() => {
    return new Map(summaries.map((summary) => [summary.emailId, summary]));
  }, [summaries]);

  const articles = useMemo<DashboardArticle[]>(() => {
    return newsletters.map((newsletter, index) => {
      const summary = summaryByEmailId.get(newsletter.id);
      const topics = parseJsonArray<string>(summary?.topics || "");
      const category = topics[0] ? titleCase(topics[0]) : summary ? "Executive Brief" : "Inbox Queue";
      return {
        id: newsletter.id,
        title: summary?.title || newsletter.subject,
        source: newsletter.senderName || newsletter.senderEmail,
        category,
        why: summary?.tldr || trimText(newsletter.bodyPlainText, 180),
        preview: trimText(newsletter.bodyPlainText, 160),
        importance: Math.max(55, 96 - index * 5 - (summary ? 0 : 10)),
        savedFormat: summary?.format ? getSummaryFormatOption(summary.format).title : undefined,
        href: `/newsletters/${newsletter.id}`,
      };
    });
  }, [newsletters, summaryByEmailId]);

  const topThree = articles.slice(0, 3);
  const briefArticles = articles.slice(0, 5);
  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    articles.forEach((article) => {
      counts.set(article.category, (counts.get(article.category) || 0) + 1);
    });
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [articles]);

  const summaryFormat = preferences?.summaryFormat || DEFAULT_SUMMARY_FORMAT;
  const formatOption = getSummaryFormatOption(summaryFormat);
  const pending = newsletters.filter((newsletter) => !newsletter.hasBeenSummarized);

  const heroTitle = connection?.connected
    ? briefArticles[0]?.title || "Your AI brief is ready as soon as the first newsletters sync in."
    : "Connect Microsoft 365 to turn your AI inbox into a daily executive brief.";

  const heroSub = connection?.connected
    ? `The highest-signal newsletter updates are ranked here first, formatted as ${formatOption.title.toLowerCase()} for faster review.`
    : "The production path is live in the app. Once the portal owner finishes the OAuth setup, this dashboard will fill with ranked newsletter stories automatically.";

  return (
    <div className="grid grid-cols-12 gap-6 text-[#e7e9ee]">
      {error ? (
        <section className="col-span-12 rounded-xl border border-red-400/25 bg-red-400/10 px-4 py-3 text-sm text-red-100">
          {error}
        </section>
      ) : null}

      <section className="col-span-12 lg:col-span-8">
        <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.03))] p-6">
          <div className="pointer-events-none absolute inset-0 rounded-2xl [background:linear-gradient(135deg,rgba(124,92,255,.6),rgba(44,208,255,.3),transparent_60%)] [mask:linear-gradient(#000_0_0)_content-box,linear-gradient(#000_0_0)] [-webkit-mask:linear-gradient(#000_0_0)_content-box,linear-gradient(#000_0_0)] [mask-composite:exclude] [-webkit-mask-composite:xor] p-px" />
          <div className="relative">
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span className="inline-flex items-center gap-[6px] rounded-full border border-[#7c5cff]/35 bg-[#7c5cff]/12 px-[10px] py-[3px] text-[11px] font-medium text-[#cdbcff]">
                    <Bolt size={11} /> Today's Brief
                  </span>
                  <span className="text-[11px] text-white/40">
                    {preferences?.hasPreferences ? `1-2 min read · formatted for ${formatOption.title}` : "Pick a format to sharpen the brief"}
                  </span>
                </div>
                <h2 className="max-w-2xl text-[24px] font-semibold tracking-tight leading-snug bg-[linear-gradient(90deg,#c8b8ff,#8ee8ff)] bg-clip-text text-transparent">
                  {heroTitle}
                </h2>
                <p className="mt-3 max-w-3xl text-[13px] leading-relaxed text-white/65">{heroSub}</p>
              </div>
            </div>

            <ol className="space-y-3">
              {briefArticles.length > 0 ? (
                briefArticles.map((article, index) => (
                  <li key={article.id}>
                    <Link
                      href={article.href}
                      className="flex gap-3 items-start p-3 -mx-3 rounded-lg hover:bg-white/[0.03] transition"
                    >
                      <div className="w-7 h-7 shrink-0 rounded-md bg-white/[0.06] border border-white/10 flex items-center justify-center text-[12px] font-medium text-white/70">
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={categoryChipClass(article.category)}>{article.category}</span>
                          <span className="text-[11px] text-white/40">{article.source}</span>
                          {article.savedFormat ? <span className="text-[11px] text-white/32">{article.savedFormat}</span> : null}
                        </div>
                        <div className="text-[14px] font-medium mt-1 leading-snug text-white">{article.title}</div>
                        <div className="text-[12.5px] text-white/55 mt-1 leading-relaxed">
                          <span className="text-white/75 font-medium">Why it matters: </span>
                          {article.why}
                        </div>
                      </div>
                      <div className="hidden sm:flex flex-col items-end gap-1 shrink-0">
                        <div className="text-[11px] text-white/40">Importance</div>
                        <div className="flex items-center gap-2">
                          <div className="w-14 h-1 rounded-full bg-white/[0.08] overflow-hidden">
                            <div
                              className="h-full bg-[linear-gradient(90deg,#7c5cff,#2cd0ff)]"
                              style={{ width: `${article.importance}%` }}
                            />
                          </div>
                          <span className="text-[12px] text-white/70 tabular-nums">{article.importance}</span>
                        </div>
                      </div>
                    </Link>
                  </li>
                ))
              ) : (
                <li className="p-4 rounded-lg border border-white/5 bg-white/[0.02] text-[13px] text-white/55 leading-relaxed">
                  No newsletters are stored yet. Once Outlook is connected and sync runs, the top stories of the day will appear here in ranked order.
                </li>
              )}
            </ol>

            <div className="flex items-center gap-2 mt-5 pt-5 border-t border-white/5 flex-wrap">
              <Link href="/newsletters" className="inline-flex items-center gap-2 rounded-[10px] border border-[#7c5cff]/60 bg-[linear-gradient(135deg,#7c5cff,#5b3df5)] px-[14px] py-[8px] text-[13px] font-medium text-white shadow-[0_6px_24px_-8px_rgba(124,92,255,.6)]">
                <FileText size={14} /> Open full brief
              </Link>
              <Link href="/settings" className="inline-flex items-center gap-2 rounded-[10px] border border-white/10 bg-white/[0.04] px-[14px] py-[8px] text-[13px] font-medium text-white transition hover:bg-white/[0.08]">
                {connection?.connected ? <CirclePlus size={14} /> : <RefreshCw size={14} />}
                {connection?.connected ? "Update format" : "Connect Microsoft"}
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="col-span-12 lg:col-span-4 flex flex-col gap-4">
        <div className="rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] backdrop-blur-[14px] p-5">
          <div className="text-[11px] uppercase tracking-wider text-white/40 mb-3">Quick actions</div>
          <div className="grid grid-cols-2 gap-2">
            <ActionTile icon={Linkedin} label="LinkedIn post" sub="From top story" href={briefArticles[0]?.href || "/newsletters"} />
            <ActionTile icon={Mail} label="Format choice" sub={formatOption.title} href="/settings" />
            <ActionTile icon={Inbox} label="Ingest" sub="Open queue" href="/ingest" />
            <ActionTile icon={BriefcaseBusiness} label="Settings" sub="OAuth status" href="/settings" />
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] backdrop-blur-[14px] p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="text-[11px] uppercase tracking-wider text-white/40">Top stories</div>
            <Link href="/newsletters" className="inline-flex items-center gap-1 rounded-[10px] px-2 py-1 text-[11px] text-white/50 transition hover:bg-white/[0.04] hover:text-white">
              View all <ChevronRight size={11} />
            </Link>
          </div>
          <div className="space-y-3">
            {topThree.length > 0 ? (
              topThree.map((article) => (
                <Link key={article.id} href={article.href} className="block cursor-pointer -mx-2 px-2 py-2 rounded-lg hover:bg-white/[0.03] transition">
                  <div className="flex items-center gap-2">
                    <span className={`${categoryChipClass(article.category)} !text-[10px] !py-0.5`}>{shortCategory(article.category)}</span>
                    <div className="ml-auto flex items-center gap-1.5">
                      <span className="text-[10px] text-white/40">imp</span>
                      <span className="text-[11px] font-medium tabular-nums text-white/70">{article.importance}</span>
                    </div>
                  </div>
                  <div className="text-[13px] font-medium mt-1 leading-snug text-white">{article.title}</div>
                </Link>
              ))
            ) : (
              <div className="text-[12px] text-white/50 leading-relaxed">Top stories will populate after the first successful sync.</div>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] backdrop-blur-[14px] p-5">
          <div className="text-[11px] uppercase tracking-wider text-white/40 mb-3">By category</div>
          <div className="space-y-2">
            {categories.length > 0 ? (
              categories.slice(0, 6).map(([category, count]) => (
                <div key={category} className="flex items-center justify-between text-[12.5px]">
                  <span className="flex items-center text-white/75">
                    <span className="inline-block w-[6px] h-[6px] rounded-full mr-[6px]" style={{ background: categoryDotColor(category) }} />
                    {category}
                  </span>
                  <span className="text-white/40 tabular-nums">{count}</span>
                </div>
              ))
            ) : (
              <div className="text-[12px] text-white/50">No categories yet.</div>
            )}
          </div>
        </div>
      </section>

      <section className="col-span-12">
        <div className="rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] backdrop-blur-[14px] p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-[11px] uppercase tracking-wider text-white/40">Workflow cues</div>
              <div className="text-[15px] font-semibold mt-0.5 text-white">What to do next</div>
            </div>
            <Link href="/settings" className="inline-flex items-center gap-2 rounded-[10px] border border-white/10 bg-white/[0.04] px-[14px] py-[8px] text-[13px] font-medium text-white transition hover:bg-white/[0.08]">
              Open settings <ChevronRight size={12} />
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            <WorkflowCard
              title="Summary format"
              subtitle={formatOption.title}
              body={preferences?.hasPreferences ? "Your preferred briefing shape is saved and will be used on new summaries." : "Choose a preferred summary format to personalize new AI briefs."}
              actionHref="/settings"
              actionLabel="Review format"
              chipLabel={preferences?.hasPreferences ? "saved" : "pending"}
            />
            <WorkflowCard
              title={connection?.connected ? "Microsoft 365 connected" : "Connect Outlook"}
              subtitle={connection?.connected ? connection.accountEmail || "Connected source" : "OAuth setup pending"}
              body={connection?.connected ? "Your inbox can sync through the production Microsoft Graph flow." : "Once the portal owner finishes the redirect URI and secret setup, this dashboard can sync live newsletters."}
              actionHref="/settings"
              actionLabel={connection?.connected ? "Connection details" : "Open settings"}
              chipLabel={connection?.connected ? "live" : "blocked"}
            />
            <WorkflowCard
              title="Needs summary"
              subtitle={`${pending.length} newsletter${pending.length === 1 ? "" : "s"} waiting`}
              body={pending.length > 0 ? "These newsletters are already stored and ready for summarization." : "Nothing is waiting right now. New synced newsletters will queue here."}
              actionHref="/newsletters"
              actionLabel="Open queue"
              chipLabel={pending.length > 0 ? `match ${pending.length}` : "clear"}
            />
          </div>
        </div>
      </section>

      {loading ? (
        <section className="col-span-12 text-[12px] text-white/45">Loading dashboard...</section>
      ) : null}
    </div>
  );
}

function ActionTile({
  icon: Icon,
  label,
  sub,
  href,
}: {
  icon: ComponentType<{ size?: number; className?: string }>;
  label: string;
  sub: string;
  href: string;
}) {
  return (
    <Link href={href} className="rounded-xl border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.03))] p-3 text-left hover:border-white/20 transition">
      <Icon size={16} className="text-violet-300 mb-2" />
      <div className="text-[13px] font-medium text-white">{label}</div>
      <div className="text-[11px] text-white/40">{sub}</div>
    </Link>
  );
}

function WorkflowCard({
  title,
  subtitle,
  body,
  actionHref,
  actionLabel,
  chipLabel,
}: {
  title: string;
  subtitle: string;
  body: string;
  actionHref: string;
  actionLabel: string;
  chipLabel: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.03))] p-4 transition hover:border-white/16">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-7 h-7 rounded-md bg-white/[0.06] border border-white/10 flex items-center justify-center text-[12px] font-medium text-white">
          {title[0]}
        </div>
        <div className="leading-tight">
          <div className="text-[13px] font-medium text-white">{title}</div>
          <div className="text-[11px] text-white/40">{subtitle}</div>
        </div>
        <div className="ml-auto inline-flex items-center rounded-full border border-[#7c5cff]/35 bg-[#7c5cff]/12 px-[10px] py-[3px] text-[10px] font-medium text-[#cdbcff]">
          {chipLabel}
        </div>
      </div>
      <div className="text-[12px] text-white/55 leading-relaxed mt-1.5">{body}</div>
      <div className="flex items-center gap-2 mt-3">
        <Link href={actionHref} className="inline-flex items-center gap-2 rounded-[10px] border border-[#7c5cff]/60 bg-[linear-gradient(135deg,#7c5cff,#5b3df5)] px-[10px] py-[6px] text-[12px] font-medium text-white shadow-[0_6px_24px_-8px_rgba(124,92,255,.6)]">
          <MessageSquareText size={12} />
          {actionLabel}
        </Link>
      </div>
    </div>
  );
}

function categoryChipClass(category: string): string {
  const base = "inline-flex items-center gap-[6px] rounded-full px-[10px] py-[3px] text-[11px] font-medium";
  if (/executive|brief|digest/i.test(category)) return `${base} border border-[#7c5cff]/35 bg-[#7c5cff]/12 text-[#cdbcff]`;
  if (/queue|pending|inbox/i.test(category)) return `${base} border border-amber-300/30 bg-amber-300/10 text-amber-100`;
  if (/topic|trend|ai|ops|automation/i.test(category)) return `${base} border border-[#2cd0ff]/30 bg-[#2cd0ff]/10 text-[#b1e9ff]`;
  return `${base} border border-emerald-400/30 bg-emerald-400/10 text-emerald-200`;
}

function categoryDotColor(category: string): string {
  if (/executive|brief|digest/i.test(category)) return "#7c5cff";
  if (/queue|pending|inbox/i.test(category)) return "#fbbf24";
  if (/topic|trend|ai|ops|automation/i.test(category)) return "#2cd0ff";
  return "#34d399";
}

function shortCategory(category: string): string {
  return category.split(" ")[0] || category;
}

function parseJsonArray<T>(value: string): T[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function titleCase(value: string): string {
  return value
    .split(/[\s_-]+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function trimText(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength).trim()}...`;
}
