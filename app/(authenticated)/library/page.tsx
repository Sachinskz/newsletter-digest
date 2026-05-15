"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Bookmark, ChevronRight, Linkedin, ListChecks, Mail, Search, Sparkles, X } from "lucide-react";
import {
  categoryTone,
  deriveLibraryArticles,
  formatReceivedAt,
  type LibraryArticle,
} from "@/lib/editorial-intelligence";
import type { NewsletterClientMatch, NewsletterEmail, NewsletterPreferences, NewsletterSummary } from "@/lib/types";

type SortKey = "importance" | "novelty" | "urgency";

export default function LibraryPage() {
  const [requestedArticleId, setRequestedArticleId] = useState<string | null>(null);
  const [articles, setArticles] = useState<LibraryArticle[]>([]);
  const [matchesByArticleId, setMatchesByArticleId] = useState<Record<string, NewsletterClientMatch[]>>({});
  const [loading, setLoading] = useState(true);
  const [preferences, setPreferences] = useState<NewsletterPreferences | null>(null);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [sort, setSort] = useState<SortKey>("importance");
  const [savedOnly, setSavedOnly] = useState(false);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [selectedArticle, setSelectedArticle] = useState<LibraryArticle | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    function syncRequestedArticle() {
      setRequestedArticleId(new URLSearchParams(window.location.search).get("article"));
    }

    syncRequestedArticle();
    window.addEventListener("popstate", syncRequestedArticle);
    return () => window.removeEventListener("popstate", syncRequestedArticle);
  }, []);

  useEffect(() => {
    let alive = true;

    async function loadArticles() {
      try {
        const [newslettersRes, summariesRes, relevanceRes, preferencesRes] = await Promise.all([
          fetch("/api/newsletters"),
          fetch("/api/summaries"),
          fetch("/api/client-relevance"),
          fetch("/api/preferences"),
        ]);
        const newslettersData = await newslettersRes.json();
        const summariesData = await summariesRes.json();
        const relevanceData = await relevanceRes.json().catch(() => ({}));
        const preferencesData = await preferencesRes.json().catch(() => ({}));

        if (!alive) return;

        const derived = deriveLibraryArticles(
          (newslettersData.newsletters || []) as NewsletterEmail[],
          (summariesData.summaries || []) as NewsletterSummary[],
          (preferencesData.preferences || null) as NewsletterPreferences | null,
        );
        setArticles(derived);
        setPreferences((preferencesData.preferences || null) as NewsletterPreferences | null);
        const groupedMatches = ((relevanceData.matches || []) as NewsletterClientMatch[]).reduce<Record<string, NewsletterClientMatch[]>>(
          (accumulator, match) => {
            if (!accumulator[match.articleId]) accumulator[match.articleId] = [];
            accumulator[match.articleId].push(match);
            return accumulator;
          },
          {},
        );
        Object.values(groupedMatches).forEach((entries) => entries.sort((a, b) => b.score - a.score));
        setMatchesByArticleId(groupedMatches);
      } catch {
        if (!alive) return;
        setArticles([]);
        setMatchesByArticleId({});
        setPreferences(null);
      } finally {
        if (alive) setLoading(false);
      }
    }

    void loadArticles();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!requestedArticleId || articles.length === 0) return;
    const matched = articles.find((article) => article.id === requestedArticleId);
    if (matched) {
      setSelectedArticle(matched);
    }
  }, [articles, requestedArticleId]);

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(null), 2200);
  }

  function toggleSave(id: string) {
    let message = "Saved for later";
    setSavedIds((current) => {
      const exists = current.includes(id);
      message = exists ? "Removed from saved" : "Saved for later";
      return exists ? current.filter((entry) => entry !== id) : [...current, id];
    });
    showToast(message);
  }

  const categories = useMemo(() => ["All", ...Array.from(new Set(articles.map((article) => article.category)))], [articles]);

  const filteredArticles = useMemo(() => {
    let result = articles.map((article) => ({ ...article, saved: savedIds.includes(article.id) }));
    if (category !== "All") {
      result = result.filter((article) => article.category === category);
    }
    if (savedOnly) {
      result = result.filter((article) => article.saved);
    }
    if (search.trim()) {
      const term = search.toLowerCase();
      result = result.filter((article) =>
        [article.title, article.summary, article.why, article.companies.join(" "), article.topics.join(" ")]
          .join(" ")
          .toLowerCase()
          .includes(term),
      );
    }
    return [...result].sort((a, b) => b[sort] - a[sort]);
  }, [articles, category, savedIds, savedOnly, search, sort]);

  return (
    <>
      <div className="space-y-5 text-[#e7e9ee]">
        <div className="analyst-glass rounded-2xl p-4 flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[240px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
            <input
              className="analyst-input pl-9"
              placeholder="Search title, company, topic..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <select className="analyst-select max-w-[200px]" value={category} onChange={(event) => setCategory(event.target.value)}>
            {categories.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <select className="analyst-select max-w-[180px]" value={sort} onChange={(event) => setSort(event.target.value as SortKey)}>
            <option value="importance">Importance</option>
            <option value="novelty">Novelty</option>
            <option value="urgency">Urgency</option>
          </select>
          <button className={`analyst-btn ${savedOnly ? "analyst-btn-primary" : ""}`} type="button" onClick={() => setSavedOnly((current) => !current)}>
            <Bookmark size={13} />
            Saved
          </button>
          {preferences?.roleTitle || preferences?.primaryFocus ? (
            <div className="analyst-chip analyst-chip-accent">{preferences.roleTitle || preferences.primaryFocus}</div>
          ) : null}
        </div>

        {loading ? (
          <div className="analyst-glass rounded-2xl p-10 text-center text-sm text-white/50">Loading article library...</div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredArticles.map((article) => {
              const saved = savedIds.includes(article.id);
              const matches = matchesByArticleId[article.id] || [];

              return (
                <div key={article.id} className="analyst-glass analyst-card-hover rounded-2xl p-5 flex flex-col">
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <span className={`analyst-chip ${categoryTone(article.category)}`}>{article.category}</span>
                    <button className="text-white/40 transition hover:text-violet-300" type="button" onClick={() => toggleSave(article.id)}>
                      <Bookmark size={15} className={saved ? "fill-violet-300 text-violet-300" : ""} />
                    </button>
                  </div>
                  <button type="button" className="text-left text-[14.5px] font-medium leading-snug text-white transition hover:text-violet-200" onClick={() => setSelectedArticle(article)}>
                    {article.title}
                  </button>
                  <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-white/40">
                    <span>{article.source}</span>
                    <span>{formatReceivedAt(article.receivedAt)}</span>
                  </div>
                  <p className="mt-2 line-clamp-3 text-[12.5px] leading-relaxed text-white/65">{article.summary}</p>
                  <div className="mt-2 line-clamp-2 text-[12px] leading-relaxed text-white/55">
                    <span className="font-medium text-white/75">Why: </span>
                    {article.why}
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] uppercase tracking-wider text-white/40">Imp</span>
                      <span className="text-[12px] font-medium tabular-nums text-white">{article.importance}</span>
                      <div className="analyst-score-bar">
                        <div style={{ width: `${article.importance}%` }} />
                      </div>
                    </div>
                    {article.companies.slice(0, 2).map((company) => (
                      <span key={company} className="analyst-chip text-[10px]">
                        {company}
                      </span>
                    ))}
                  </div>

                  {matches.length > 0 ? (
                    <div className="mt-3 rounded-lg border border-violet-400/15 bg-violet-500/[0.06] p-2">
                      <div className="mb-1 text-[11px] uppercase tracking-wider text-white/55">Relevant for</div>
                      <div className="flex flex-wrap gap-1.5">
                        {matches.slice(0, 3).map((entry) => (
                          <span key={`${entry.clientId}-${entry.articleId}`} className="analyst-chip analyst-chip-accent text-[10px]">
                            {entry.clientName} · {entry.score}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <div className="mt-auto flex items-center gap-1.5 pt-4">
                    <Link className="analyst-btn py-1.5 text-[11.5px]" href={`/generate?article=${encodeURIComponent(article.id)}&kind=linkedin`}>
                      <Linkedin size={11} />
                      LinkedIn
                    </Link>
                    <Link className="analyst-btn py-1.5 text-[11.5px]" href={`/generate?article=${encodeURIComponent(article.id)}&kind=email`}>
                      <Mail size={11} />
                      Email
                    </Link>
                    <button className="analyst-btn analyst-btn-ghost ml-auto py-1.5 text-[11.5px]" type="button" onClick={() => setSelectedArticle(article)}>
                      Open
                      <ChevronRight size={11} />
                    </button>
                  </div>
                </div>
              );
            })}

            {filteredArticles.length === 0 ? (
              <div className="analyst-glass col-span-full rounded-2xl p-10 text-center text-sm text-white/50">
                {articles.length === 0
                  ? "No real articles are available yet. Connect Microsoft 365 and run a sync to populate the library."
                  : "No articles match your filters."}
              </div>
            ) : null}
          </div>
        )}
      </div>

      {selectedArticle ? (
        <ArticleDrawer
          article={selectedArticle}
          saved={savedIds.includes(selectedArticle.id)}
          onClose={() => setSelectedArticle(null)}
          onToggleSave={() => toggleSave(selectedArticle.id)}
        />
      ) : null}

      {toast ? (
        <div className="fixed bottom-5 right-5 z-50 rounded-xl border border-white/10 bg-[#0d1017]/95 px-4 py-3 text-[12.5px] text-white shadow-[0_18px_60px_rgba(0,0,0,0.35)] backdrop-blur-xl">
          {toast}
        </div>
      ) : null}
    </>
  );
}

function ArticleDrawer({
  article,
  saved,
  onClose,
  onToggleSave,
}: {
  article: LibraryArticle;
  saved: boolean;
  onClose: () => void;
  onToggleSave: () => void;
}) {
  useEffect(() => {
    function onEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-40 flex">
      <div className="flex-1 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <aside className="analyst-scrollbar h-full w-full max-w-[560px] overflow-y-auto border-l border-white/10 bg-[#0a0c12]">
        <div className="p-6">
          <div className="mb-4 flex items-center justify-between">
            <span className={`analyst-chip ${categoryTone(article.category)}`}>{article.category}</span>
            <div className="flex items-center gap-1">
              <button className="analyst-btn analyst-btn-ghost px-2 py-1.5" type="button" onClick={onToggleSave}>
                <Bookmark size={14} className={saved ? "fill-violet-300 text-violet-300" : ""} />
              </button>
              <button className="analyst-btn analyst-btn-ghost px-2 py-1.5" type="button" onClick={onClose}>
                <X size={14} />
              </button>
            </div>
          </div>

          <h2 className="text-[20px] font-semibold leading-snug tracking-tight text-white">{article.title}</h2>
          <div className="mt-1 text-[12px] text-white/40">{article.source}</div>

          <div className="mt-5 grid grid-cols-3 gap-2">
            <ScoreCard label="Importance" value={article.importance} />
            <ScoreCard label="Novelty" value={article.novelty} />
            <ScoreCard label="Urgency" value={article.urgency} />
          </div>

          <div className="mt-5">
            <div className="mb-1.5 text-[11px] uppercase tracking-wider text-white/40">Summary</div>
            <p className="text-[14px] leading-relaxed text-white/80">{article.summary}</p>
          </div>

          {article.summaryRecord ? (
            <div className="mt-5 rounded-xl border border-violet-400/15 bg-violet-500/[0.05] p-4">
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-violet-200/80">
                <Sparkles size={13} />
                AI brief
              </div>
              <div className="mt-2 text-[16px] font-medium leading-snug text-white">{article.summaryRecord.title}</div>
              <p className="mt-2 text-[13.5px] leading-6 text-white/78">{article.summaryRecord.tldr}</p>

              {parseKeyPoints(article.summaryRecord.keyPoints).length > 0 ? (
                <div className="mt-4">
                  <div className="mb-2 flex items-center gap-2 text-[11px] uppercase tracking-wider text-white/40">
                    <ListChecks size={13} />
                    Key points
                  </div>
                  <ul className="space-y-2">
                    {parseKeyPoints(article.summaryRecord.keyPoints).map((item, index) => (
                      <li key={`${item.point}-${index}`} className="text-[13px] leading-6 text-white/72">
                        <span className="font-semibold text-white/88">{item.importance}</span>: {item.point}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {parseActionItems(article.summaryRecord.actionItems).length > 0 ? (
                <div className="mt-4">
                  <div className="mb-2 text-[11px] uppercase tracking-wider text-white/40">Action items</div>
                  <ul className="space-y-2">
                    {parseActionItems(article.summaryRecord.actionItems).map((item, index) => (
                      <li key={`${item.action}-${index}`} className="text-[13px] leading-6 text-white/72">
                        <span className="font-semibold text-white/88">{item.urgency}</span>: {item.action}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="mt-5 rounded-xl border border-white/8 bg-white/[0.02] p-4 text-[13px] leading-6 text-white/58">
              No AI summary has been generated for this article yet.
            </div>
          )}

          <div className="mt-5">
            <div className="mb-1.5 text-[11px] uppercase tracking-wider text-white/40">Why it matters</div>
            <p className="text-[14px] leading-relaxed text-white/80">{article.why}</p>
          </div>

          <div className="mt-5">
            <div className="mb-1.5 text-[11px] uppercase tracking-wider text-white/40">Full article</div>
            <div className="max-h-[42vh] overflow-y-auto rounded-xl border border-white/8 bg-white/[0.02] p-4 text-[13.5px] leading-7 text-white/72 whitespace-pre-wrap">
              {article.body}
            </div>
          </div>

          {article.companies.length || article.topics.length ? (
            <div className="mt-5 space-y-3">
              {article.companies.length ? (
                <div>
                  <div className="mb-1.5 text-[11px] uppercase tracking-wider text-white/40">Companies</div>
                  <div className="flex flex-wrap gap-1.5">
                    {article.companies.map((company) => (
                      <span key={company} className="analyst-chip">
                        {company}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
              {article.topics.length ? (
                <div>
                  <div className="mb-1.5 text-[11px] uppercase tracking-wider text-white/40">Topics</div>
                  <div className="flex flex-wrap gap-1.5">
                    {article.topics.map((topic) => (
                      <span key={topic} className="analyst-chip analyst-chip-cyan">
                        {topic}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="mt-6 grid grid-cols-2 gap-2">
            <Link className="analyst-btn analyst-btn-primary justify-center" href={`/generate?article=${encodeURIComponent(article.id)}&kind=linkedin`}>
              <Linkedin size={13} />
              LinkedIn post
            </Link>
            <div className="analyst-btn cursor-not-allowed justify-center opacity-50">
              <Mail size={13} />
              Client email locked
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}

function ScoreCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-white/5 bg-white/[0.03] p-2.5">
      <div className="text-[10px] uppercase tracking-wider text-white/40">{label}</div>
      <div className="mt-0.5 text-[18px] font-semibold leading-tight tabular-nums text-white">{value}</div>
      <div className="analyst-score-bar mt-1.5">
        <div style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function parseKeyPoints(value: string): Array<{ point: string; importance: string }> {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter(
          (item): item is { point: string; importance: string } =>
            Boolean(item) &&
            typeof item === "object" &&
            typeof (item as { point?: unknown }).point === "string" &&
            typeof (item as { importance?: unknown }).importance === "string",
        )
      : [];
  } catch {
    return [];
  }
}

function parseActionItems(value: string): Array<{ action: string; urgency: string }> {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter(
          (item): item is { action: string; urgency: string } =>
            Boolean(item) &&
            typeof item === "object" &&
            typeof (item as { action?: unknown }).action === "string" &&
            typeof (item as { urgency?: unknown }).urgency === "string",
        )
      : [];
  } catch {
    return [];
  }
}
