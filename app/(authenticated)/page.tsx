"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { ComponentType } from "react";
import {
  Bolt,
  BriefcaseBusiness,
  ChevronRight,
  FileText,
  Inbox,
  Linkedin,
  Mail,
  MessageSquareText,
} from "lucide-react";
import { deriveLibraryArticles } from "@/lib/editorial-intelligence";
import { DEFAULT_SUMMARY_FORMAT, getSummaryFormatOption } from "@/lib/summarization";
import type { NewsletterEmail, NewsletterPreferences, NewsletterSummary, SummaryFormat } from "@/lib/types";

interface SystemStatus {
  configured: boolean;
  mailbox: string | null;
  articleCount: number;
  subscriptionCount: number;
  lastSyncAt: string | null;
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
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [preferences, setPreferences] = useState<PreferencesResponse | null>(null);
  const [newsletters, setNewsletters] = useState<NewsletterEmail[]>([]);
  const [summaries, setSummaries] = useState<NewsletterSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadDashboard(): Promise<SystemStatus | null> {
    setError(null);
    try {
      const [systemStatusRes, preferencesRes, newslettersRes, summariesRes] = await Promise.all([
        fetch("/api/system/status"),
        fetch("/api/preferences"),
        fetch("/api/newsletters"),
        fetch("/api/summaries"),
      ]);

      const systemStatusData = systemStatusRes.ok ? await systemStatusRes.json() : null;
      const preferencesData = preferencesRes.ok ? await preferencesRes.json() : null;
      const newslettersData = newslettersRes.ok ? await newslettersRes.json() : { newsletters: [] };
      const summariesData = summariesRes.ok ? await summariesRes.json() : { summaries: [] };

      setSystemStatus(systemStatusData);
      setPreferences(preferencesData);
      setNewsletters(newslettersData.newsletters || []);
      setSummaries(summariesData.summaries || []);
      return systemStatusData;
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Dashboard failed to load");
      return null;
    } finally {
      setLoading(false);
    }
  }

  async function autoSync() {
    try {
      const res = await fetch("/api/system/sync", { method: "POST" });
      if (res.ok) await loadDashboard();
    } catch {
      // silent — dashboard shows whatever was already loaded
    }
  }

  useEffect(() => {
    void loadDashboard().then((status) => {
      if (status?.configured && status.articleCount === 0) {
        void autoSync();
      }
    });
  }, []);

  const articles = useMemo<DashboardArticle[]>(() => {
    return deriveLibraryArticles(newsletters, summaries, preferences?.preferences || null)
      .map((article) => ({
        id: article.id,
        title: article.title,
        source: article.source,
        category: article.category,
        why: article.why,
        preview: trimText(article.body, 160),
        importance: article.importance,
        savedFormat: article.savedFormat,
        href: `/library?article=${encodeURIComponent(article.id)}`,
      }))
      .sort((a, b) => b.importance - a.importance);
  }, [newsletters, preferences?.preferences, summaries]);

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

  const heroTitle = briefArticles[0]?.title || "Your AI brief is ready as soon as the first newsletters sync in.";
  const heroSub = `The highest-signal newsletter updates are ranked here first, formatted as ${formatOption.title.toLowerCase()} for faster review.`;

  if (loading) {
    return (
      <div className="grid grid-cols-12 gap-6 text-[#e7e9ee]">
        <section className="col-span-12 lg:col-span-8">
          <DashboardHeroSkeleton />
        </section>
        <section className="col-span-12 space-y-4 lg:col-span-4">
          <DashboardMiniSkeleton />
          <DashboardListSkeleton />
          <DashboardMiniSkeleton />
        </section>
        <section className="col-span-12">
          <DashboardWorkflowSkeleton />
        </section>
      </div>
    );
  }

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
                    <Bolt size={11} /> Today&apos;s Brief
                  </span>
                  <span className="text-[11px] text-white/40">
                    1-2 min read · formatted for {formatOption.title}
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
                  No articles yet. Head to the Ingest page and click Sync now to pull newsletters from the shared mailbox.
                </li>
              )}
            </ol>

            <div className="flex items-center gap-2 mt-5 pt-5 border-t border-white/5 flex-wrap">
              <Link href="/library" className="inline-flex items-center gap-2 rounded-[10px] border border-[#7c5cff]/60 bg-[linear-gradient(135deg,#7c5cff,#5b3df5)] px-[14px] py-[8px] text-[13px] font-medium text-white shadow-[0_6px_24px_-8px_rgba(124,92,255,.6)]">
                <FileText size={14} /> Open full brief
              </Link>
              <Link href="/settings" className="inline-flex items-center gap-2 rounded-[10px] border border-white/10 bg-white/[0.04] px-[14px] py-[8px] text-[13px] font-medium text-white transition hover:bg-white/[0.08]">
                Update format
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="col-span-12 lg:col-span-4 flex flex-col gap-4">
        <div className="rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] backdrop-blur-[14px] p-5">
          <div className="text-[11px] uppercase tracking-wider text-white/40 mb-3">Quick actions</div>
          <div className="grid grid-cols-2 gap-2">
            <ActionTile icon={Linkedin} label="LinkedIn post" sub="From top story" href={briefArticles[0]?.href || "/library"} />
            <ActionTile icon={Mail} label="Format choice" sub={formatOption.title} href="/settings" />
            <ActionTile icon={Inbox} label="Ingest" sub="Open queue" href="/ingest" />
            <ActionTile icon={BriefcaseBusiness} label="Clients" sub="Match stories" href="/clients" />
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] backdrop-blur-[14px] p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="text-[11px] uppercase tracking-wider text-white/40">Top stories</div>
            <Link href="/library" className="inline-flex items-center gap-1 rounded-[10px] px-2 py-1 text-[11px] text-white/50 transition hover:bg-white/[0.04] hover:text-white">
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
              categories.slice(0, 6).map(([cat, count]) => (
                <div key={cat} className="flex items-center justify-between text-[12.5px]">
                  <span className="flex items-center text-white/75">
                    <span className="inline-block w-[6px] h-[6px] rounded-full mr-[6px]" style={{ background: categoryDotColor(cat) }} />
                    {cat}
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
              title={systemStatus?.configured ? "Shared mailbox active" : "Article source"}
              subtitle={systemStatus?.configured ? (systemStatus.mailbox || "Shared mailbox") : "Not configured"}
              body={systemStatus?.configured ? "Articles are pulled from the shared mailbox using app-only authentication. All team members see the same feed." : "Configure the shared mailbox environment variables to start syncing."}
              actionHref="/ingest"
              actionLabel={systemStatus?.configured ? "Open ingest" : "Open ingest"}
              chipLabel={systemStatus?.configured ? "shared" : "needed"}
            />
            <WorkflowCard
              title="Needs summary"
              subtitle={`${pending.length} newsletter${pending.length === 1 ? "" : "s"} waiting`}
              body={pending.length > 0 ? "These newsletters are already stored and ready for summarization." : "Nothing is waiting right now. New synced newsletters will queue here."}
              actionHref="/library"
              actionLabel="Open queue"
              chipLabel={pending.length > 0 ? `match ${pending.length}` : "clear"}
            />
          </div>
        </div>
      </section>
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

function DashboardHeroSkeleton() {
  return (
    <div className="rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] p-6">
      <div className="animate-pulse space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-5 w-24 rounded-full bg-white/[0.06]" />
          <div className="h-3 w-36 rounded bg-white/[0.04]" />
        </div>
        <div className="h-6 w-3/4 rounded bg-white/[0.06]" />
        <div className="h-4 w-full rounded bg-white/[0.04]" />
        <div className="space-y-3 pt-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="flex items-center gap-3">
              <div className="h-7 w-7 rounded-md bg-white/[0.06]" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 w-24 rounded bg-white/[0.05]" />
                <div className="h-4 w-3/4 rounded bg-white/[0.04]" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function DashboardMiniSkeleton() {
  return (
    <div className="rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] p-5">
      <div className="animate-pulse space-y-3">
        <div className="h-4 w-24 rounded bg-white/[0.06]" />
        <div className="h-6 w-20 rounded bg-white/[0.05]" />
        <div className="h-3 w-full rounded bg-white/[0.04]" />
        <div className="h-3 w-2/3 rounded bg-white/[0.04]" />
      </div>
    </div>
  );
}

function DashboardListSkeleton() {
  return (
    <div className="rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] p-5">
      <div className="animate-pulse space-y-3">
        <div className="h-4 w-28 rounded bg-white/[0.06]" />
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-white/[0.06]" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3 w-24 rounded bg-white/[0.05]" />
              <div className="h-4 w-5/6 rounded bg-white/[0.04]" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DashboardWorkflowSkeleton() {
  return (
    <div className="rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] p-6">
      <div className="animate-pulse space-y-4">
        <div className="h-5 w-44 rounded bg-white/[0.06]" />
        <div className="grid gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="rounded-xl border border-white/6 bg-white/[0.02] p-4 space-y-3">
              <div className="h-3 w-24 rounded bg-white/[0.05]" />
              <div className="h-4 w-2/3 rounded bg-white/[0.06]" />
              <div className="h-3 w-full rounded bg-white/[0.04]" />
              <div className="h-9 w-28 rounded-lg bg-white/[0.05]" />
            </div>
          ))}
        </div>
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

function trimText(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength).trim()}...`;
}
