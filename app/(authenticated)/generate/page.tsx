"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Check,
  Clipboard,
  ExternalLink,
  Linkedin,
  LoaderCircle,
  Mail,
  MessageSquareText,
  PenLine,
  Plus,
  RefreshCw,
  Send,
  Sparkles,
  TrendingUp,
  X,
} from "lucide-react";
import { deriveLibraryArticles, type LibraryArticle } from "@/lib/editorial-intelligence";
import { CONTENT_KINDS, CONTENT_TONES, getContentKindLabel } from "@/lib/content-generation";
import type {
  ContentKind,
  ContentTone,
  GeneratedContent,
  NewsletterClientProfile,
  NewsletterEmail,
  NewsletterPreferences,
  NewsletterSummary,
} from "@/lib/types";

interface PreferencesResponse {
  preferences: NewsletterPreferences | null;
}

const KIND_ICONS: Record<ContentKind, typeof Linkedin> = {
  linkedin: Linkedin,
  email: Mail,
  thought: Sparkles,
  newsletter: PenLine,
  talking: MessageSquareText,
  investor: TrendingUp,
};

interface LinkedInStatusResponse {
  connected: boolean;
  memberId?: string;
  memberName?: string;
  memberEmail?: string;
  status?: string;
  accessTokenExpiresAt?: string;
  connectedAt?: string;
  lastUsedAt?: string;
}

export default function GeneratePage() {
  const [articles, setArticles] = useState<LibraryArticle[]>([]);
  const [clients, setClients] = useState<NewsletterClientProfile[]>([]);
  const [recentDrafts, setRecentDrafts] = useState<GeneratedContent[]>([]);
  const [linkedInConnection, setLinkedInConnection] = useState<LinkedInStatusResponse | null>(null);
  const [articleIds, setArticleIds] = useState<string[]>([""]);
  const [clientId, setClientId] = useState("");
  const [kind, setKind] = useState<ContentKind>("linkedin");
  const [tone, setTone] = useState<ContentTone>("Analytical");
  const [generated, setGenerated] = useState<GeneratedContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [publishMessage, setPublishMessage] = useState<string | null>(null);
  const [confirmingPublish, setConfirmingPublish] = useState(false);
  const [confirmCountdown, setConfirmCountdown] = useState(3);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    async function load() {
      setError(null);
      try {
        const [newslettersRes, summariesRes, contentRes, clientsRes, linkedInStatusRes, preferencesRes] = await Promise.all([
          fetch("/api/newsletters"),
          fetch("/api/summaries"),
          fetch("/api/content"),
          fetch("/api/clients"),
          fetch("/api/linkedin/status"),
          fetch("/api/preferences"),
        ]);
        const newslettersData = await newslettersRes.json();
        const summariesData = await summariesRes.json();
        const contentData = await contentRes.json();
        const clientsData = await clientsRes.json();
        const linkedInStatusData = await linkedInStatusRes.json();
        const preferencesData = (await preferencesRes.json()) as PreferencesResponse;

        if (!alive) return;

        const nextArticles = deriveLibraryArticles(
          (newslettersData.newsletters || []) as NewsletterEmail[],
          (summariesData.summaries || []) as NewsletterSummary[],
          (preferencesData.preferences || null) as NewsletterPreferences | null,
        );
        const nextClients = (clientsData.clients || []) as NewsletterClientProfile[];
        setArticles(nextArticles);
        setClients(nextClients);
        setLinkedInConnection(linkedInStatusData);

        const params = new URLSearchParams(window.location.search);
        const requestedArticle = params.get("article");
        const requestedKind = params.get("kind");
        const initialId = nextArticles.some((item) => item.id === requestedArticle) ? requestedArticle || "" : nextArticles[0]?.id || "";
        setArticleIds([initialId]);
        if (CONTENT_KINDS.some((item) => item.id === requestedKind && (!item.needsClient || nextClients.length > 0))) {
          setKind(requestedKind as ContentKind);
        }
        setClientId(nextClients[0]?.id || "");
        setRecentDrafts(contentData.content || []);
      } catch (loadError) {
        if (!alive) return;
        setArticles([]);
        setClients([]);
        setRecentDrafts([]);
        setLinkedInConnection(null);
        setArticleIds([""]);
        setClientId("");
        setError(loadError instanceof Error ? loadError.message : "Could not load generator context");
      } finally {
        if (alive) setLoading(false);
      }
    }

    void load();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!confirmingPublish) return;
    if (confirmCountdown <= 0) return;

    const timer = window.setTimeout(() => {
      setConfirmCountdown((current) => current - 1);
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [confirmingPublish, confirmCountdown]);

  const selectedArticles = useMemo(
    () =>
      articleIds
        .map((id) => articles.find((item) => item.id === id))
        .filter((item): item is NonNullable<typeof item> => Boolean(item)),
    [articleIds, articles],
  );
  const selectedClient = useMemo(() => clients.find((item) => item.id === clientId) || clients[0] || null, [clientId, clients]);
  const selectedKind = CONTENT_KINDS.find((item) => item.id === kind) || CONTENT_KINDS[0];

  async function generate() {
    if (selectedArticles.length === 0) return;
    if (selectedKind.needsClient && !selectedClient) {
      setError("Create a client profile first, then select it for client-email generation.");
      return;
    }

    setGenerating(true);
    setGenerated(null);
    setError(null);
    setPublishMessage(null);
    setConfirmingPublish(false);
    setConfirmCountdown(3);
    try {
      const res = await fetch("/api/content/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          articles: selectedArticles,
          kind,
          tone,
          client: selectedKind.needsClient ? selectedClient : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const msg = [data.error, data.details].filter(Boolean).join(" — ");
        throw new Error(msg || "Could not generate content");
      }
      setGenerated(data.content);
      setRecentDrafts((current) => [data.content, ...current.filter((item) => item.id !== data.content.id)].slice(0, 6));
    } catch (generateError) {
      setError(generateError instanceof Error ? generateError.message : "Could not generate content");
    } finally {
      setGenerating(false);
    }
  }

  async function copyDraft() {
    if (!generated) return;
    const text = generated.kind === "email" ? `Subject: ${generated.subject || ""}\n\n${generated.body}` : generated.body;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  async function publishGeneratedDraft() {
    if (!generated || generated.kind !== "linkedin") return;

    setPublishing(true);
    setError(null);
    setPublishMessage(null);
    try {
      const res = await fetch(`/api/content/${generated.id}/publish-linkedin`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not publish to LinkedIn");

      setGenerated(data.content);
      setRecentDrafts((current) => [data.content, ...current.filter((item) => item.id !== data.content.id)].slice(0, 6));
      setLinkedInConnection((current) =>
        current
          ? {
              ...current,
              connected: true,
              status: "active",
              lastUsedAt: data.content?.publishedAt || new Date().toISOString(),
            }
          : current,
      );
      setPublishMessage("LinkedIn draft published directly from Newsletter Digest.");
      setConfirmingPublish(false);
      setConfirmCountdown(3);
    } catch (publishError) {
      setError(publishError instanceof Error ? publishError.message : "Could not publish to LinkedIn");
    } finally {
      setPublishing(false);
    }
  }

  function startPublishConfirmation() {
    setError(null);
    setPublishMessage(null);
    setConfirmingPublish(true);
    setConfirmCountdown(3);
  }

  function cancelPublishConfirmation() {
    setConfirmingPublish(false);
    setConfirmCountdown(3);
  }

  return (
    <div className="grid grid-cols-12 gap-6 text-[#e7e9ee]">
      <section className="col-span-12 space-y-4 lg:col-span-4">
        <div className="analyst-glass rounded-2xl p-5">
          <div className="mb-1 text-[13px] font-medium text-white">1. Pick articles</div>
          <div className="mb-3 text-[11px] text-white/45">Combine up to 3 — opposing views make the best posts.</div>

          <div className="space-y-3">
            {articleIds.map((id, index) => {
              const picked = articles.find((a) => a.id === id);
              return (
                <div key={index}>
                  <div className="flex items-center gap-2">
                    <select
                      className="analyst-select flex-1"
                      value={id}
                      onChange={(event) => {
                        setArticleIds((current) => current.map((cur, i) => (i === index ? event.target.value : cur)));
                      }}
                      disabled={loading}
                    >
                      {articles.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.title.slice(0, 80)}
                        </option>
                      ))}
                    </select>
                    {index > 0 ? (
                      <button
                        type="button"
                        onClick={() => setArticleIds((current) => current.filter((_, i) => i !== index))}
                        className="analyst-btn px-2 py-1.5 text-white/50 hover:text-white"
                      >
                        <X size={13} />
                      </button>
                    ) : null}
                  </div>
                  {picked ? (
                    <div className="mt-2 rounded-lg border border-white/5 bg-white/[0.03] p-3">
                      <span className="analyst-chip analyst-chip-accent">{picked.category}</span>
                      <div className="mt-2 text-[12px] leading-relaxed text-white/65">{picked.summary}</div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>

          {articles.length === 0 ? (
            <div className="mt-3 rounded-lg border border-white/5 bg-white/[0.03] p-3 text-[12.5px] leading-relaxed text-white/55">
              No articles yet. Sync newsletters first.
            </div>
          ) : articleIds.length < 3 ? (
            <button
              type="button"
              onClick={() => setArticleIds((current) => [...current, articles.find((a) => !current.includes(a.id))?.id || articles[0].id])}
              className="analyst-btn mt-3 w-full justify-center py-2 text-[12px]"
            >
              <Plus size={12} />
              Add another article
            </button>
          ) : null}
        </div>

        <div className="analyst-glass rounded-2xl p-5">
          <div className="mb-3 text-[13px] font-medium text-white">2. Output type</div>
          <div className="grid grid-cols-2 gap-2">
            {CONTENT_KINDS.map((item) => {
              const active = kind === item.id;
              const Icon = KIND_ICONS[item.id];
              const disabled = Boolean(item.needsClient && clients.length === 0);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => !disabled && setKind(item.id)}
                  disabled={disabled}
                  className={`min-h-[82px] rounded-lg border p-3 text-left transition ${
                    disabled
                      ? "cursor-not-allowed border-white/5 bg-white/[0.015] opacity-45"
                      : active
                        ? "border-violet-400/50 bg-violet-500/10"
                        : "border-white/5 bg-white/[0.02] hover:bg-white/[0.04]"
                  }`}
                >
                  <Icon size={14} className={disabled ? "text-white/35" : active ? "text-violet-300" : "text-white/60"} />
                  <div className={`mt-1.5 text-[12.5px] font-medium ${active ? "text-white" : "text-white/75"}`}>{item.label}</div>
                  {disabled ? <div className="mt-1 text-[11px] text-white/45">Add a client profile first</div> : null}
                </button>
              );
            })}
          </div>
        </div>

        {selectedKind.needsClient ? (
          <div className="analyst-glass rounded-2xl p-5">
            <div className="mb-3 text-[13px] font-medium text-white">3. Client context</div>
            {clients.length > 0 ? (
              <>
                <select className="analyst-select" value={clientId} onChange={(event) => setClientId(event.target.value)}>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name} · {client.sector}
                    </option>
                  ))}
                </select>
                {selectedClient ? (
                  <div className="mt-3 rounded-lg border border-white/5 bg-white/[0.03] p-3 text-[12.5px] leading-relaxed text-white/68">
                    <div className="font-medium text-white">{selectedClient.name}</div>
                    <div className="mt-1 text-white/55">{selectedClient.priorities}</div>
                  </div>
                ) : null}
              </>
            ) : (
              <div className="rounded-lg border border-white/5 bg-white/[0.03] p-3 text-[12.5px] leading-relaxed text-white/55">
                No client profiles are available yet. Create one from the Client Relevance page.
              </div>
            )}
          </div>
        ) : null}

        <div className="analyst-glass rounded-2xl p-5">
          <div className="mb-3 text-[13px] font-medium text-white">{selectedKind.needsClient ? "4. Tone" : "3. Tone"}</div>
          <div className="flex flex-wrap gap-1.5">
            {CONTENT_TONES.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setTone(item)}
                className={`analyst-chip cursor-pointer ${tone === item ? "analyst-chip-accent" : ""}`}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="col-span-12 lg:col-span-8">
        <div className="analyst-glass relative overflow-hidden rounded-2xl p-6">
          <div className="pointer-events-none absolute inset-0 rounded-2xl [background:linear-gradient(135deg,rgba(124,92,255,.45),rgba(44,208,255,.18),transparent_62%)] [mask:linear-gradient(#000_0_0)_content-box,linear-gradient(#000_0_0)] [-webkit-mask:linear-gradient(#000_0_0)_content-box,linear-gradient(#000_0_0)] [mask-composite:exclude] [-webkit-mask-composite:xor] p-px" />
          <div className="relative">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <div className="text-[11px] uppercase tracking-wider text-white/40">Generated</div>
                <div className="mt-0.5 text-[15px] font-medium text-white">{selectedKind?.label || getContentKindLabel(kind)}</div>
              </div>
              <div className="flex items-center gap-2">
                {generated?.kind === "linkedin" ? (
                  linkedInConnection?.connected ? (
                    confirmingPublish ? (
                      <>
                        <button
                          className="analyst-btn"
                          type="button"
                          onClick={cancelPublishConfirmation}
                          disabled={publishing}
                        >
                          Cancel
                        </button>
                        <button
                          className="analyst-btn analyst-btn-primary"
                          type="button"
                          onClick={publishGeneratedDraft}
                          disabled={publishing || confirmCountdown > 0}
                        >
                          {publishing ? <LoaderCircle size={13} className="animate-spin" /> : <Linkedin size={13} />}
                          {confirmCountdown > 0 ? `Are you sure? ${confirmCountdown}s` : "Yes, post to LinkedIn"}
                        </button>
                      </>
                    ) : (
                      <button className="analyst-btn" type="button" onClick={startPublishConfirmation} disabled={publishing}>
                        <Linkedin size={13} />
                        {generated.publishStatus === "published" ? "Create another post to LinkedIn" : "Create post to LinkedIn"}
                      </button>
                    )
                  ) : (
                    <Link href="/api/linkedin/authorize" className="analyst-btn">
                      <Linkedin size={13} />
                      Connect LinkedIn
                    </Link>
                  )
                ) : null}
                <button className="analyst-btn" type="button" onClick={copyDraft} disabled={!generated}>
                  {copied ? <Check size={13} /> : <Clipboard size={13} />}
                  {copied ? "Copied" : "Copy"}
                </button>
                <button className="analyst-btn analyst-btn-primary" type="button" onClick={generate} disabled={selectedArticles.length === 0 || generating}>
                  {generating ? <LoaderCircle size={13} className="animate-spin" /> : <Send size={13} />}
                  {generating ? "Generating..." : generated ? "Regenerate" : "Generate"}
                </button>
              </div>
            </div>

            {generated ? (
              <>
                {generated.kind === "email" ? (
                  <>
                    <div className="mb-3 border-b border-white/5 pb-3">
                      <div className="mb-1 text-[11px] uppercase tracking-wider text-white/40">Subject</div>
                      <div className="text-[14px] font-medium text-white">{generated.subject}</div>
                    </div>
                    <div className="whitespace-pre-wrap text-[13.5px] leading-relaxed text-white/85">{generated.body}</div>
                  </>
                ) : (
                  <div className="whitespace-pre-wrap text-[13.5px] leading-relaxed text-white/85">{generated.body}</div>
                )}

                {generated.kind === "linkedin" ? (
                  <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-white/5 pt-4 text-[11.5px] text-white/55">
                    <span className={`analyst-chip ${generated.publishStatus === "published" ? "analyst-chip-good" : generated.publishStatus === "failed" ? "analyst-chip-warn" : ""}`}>
                      {formatPublishStatus(generated.publishStatus)}
                    </span>
                    {generated.publishedAt ? <span>Published {formatCompactDateTime(generated.publishedAt)}</span> : null}
                    {generated.externalPostId ? (
                      <span className="inline-flex items-center gap-1 text-white/45">
                        <ExternalLink size={11} />
                        {generated.externalPostId}
                      </span>
                    ) : null}
                  </div>
                ) : null}
              </>
            ) : (
              <div className="rounded-xl border border-white/5 bg-white/[0.02] p-6 text-[13px] leading-relaxed text-white/55">
                {loading ? "Loading generator context..." : "Choose 1–3 articles and an output type, then generate a draft."}
              </div>
            )}

            {generated?.kind === "linkedin" && !linkedInConnection?.connected ? (
              <div className="mt-4 rounded-xl border border-white/5 bg-white/[0.02] p-4 text-[12.5px] leading-relaxed text-white/60">
                Direct LinkedIn publish is available once you connect a personal LinkedIn profile from Settings. Until then you can still generate and copy drafts safely.
              </div>
            ) : null}

            {generated?.kind === "linkedin" && linkedInConnection?.connected && confirmingPublish ? (
              <div className="mt-4 rounded-xl border border-amber-300/20 bg-amber-300/10 px-4 py-3 text-[12.5px] leading-relaxed text-amber-100/85">
                This post will go directly to the connected LinkedIn profile. Review the copy first, then confirm after the 3-second safety delay.
              </div>
            ) : null}

            {publishMessage ? (
              <div className="mt-4 rounded-xl border border-emerald-400/25 bg-emerald-400/10 px-4 py-3 text-[13px] text-emerald-100">
                {publishMessage}
              </div>
            ) : null}

            <div className="mt-5 flex items-center gap-2 border-t border-white/5 pt-5 text-[11px] text-white/40">
              <Sparkles size={11} />
              <span>{generated ? `Saved as ${generated.title}` : selectedKind?.description}</span>
              <span className="ml-auto">Review before sending.</span>
            </div>
          </div>
        </div>

        {error ? <div className="mt-4 rounded-xl border border-red-400/25 bg-red-400/10 px-4 py-3 text-[13px] text-red-100">{error}</div> : null}

        <div className="mt-5 analyst-glass rounded-2xl p-5">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-[13px] font-medium text-white">Recent drafts</div>
            <button className="analyst-btn py-1.5 text-[11.5px]" type="button" onClick={() => window.location.reload()}>
              <RefreshCw size={11} />
              Refresh
            </button>
          </div>
          <div className="space-y-2">
            {recentDrafts.length ? (
              recentDrafts.map((draft) => (
                <button
                  key={draft.id}
                  type="button"
                  onClick={() => {
                    setGenerated(draft);
                    setPublishMessage(null);
                    setError(null);
                    setConfirmingPublish(false);
                    setConfirmCountdown(3);
                  }}
                  className="flex w-full items-center gap-3 rounded-lg border border-white/5 bg-white/[0.02] p-2.5 text-left transition hover:bg-white/[0.04]"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-white/[0.04] text-[11px] font-medium text-white">
                    {draft.kind.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-medium text-white">{draft.title}</div>
                    <div className="truncate text-[11px] text-white/42">{draft.articleTitle}</div>
                  </div>
                  {draft.kind === "linkedin" ? (
                    <span className={`analyst-chip text-[10px] ${draft.publishStatus === "published" ? "analyst-chip-good" : draft.publishStatus === "failed" ? "analyst-chip-warn" : ""}`}>
                      {formatPublishStatus(draft.publishStatus)}
                    </span>
                  ) : null}
                  <span className="analyst-chip text-[10px]">{draft.tone}</span>
                </button>
              ))
            ) : (
              <div className="rounded-lg border border-white/5 bg-white/[0.02] p-4 text-[12.5px] text-white/50">
                Draft history will appear after the first generation.
              </div>
            )}
          </div>
        </div>

        {clients.length === 0 ? (
          <div className="mt-5 rounded-xl border border-amber-300/20 bg-amber-300/10 px-4 py-3 text-[12.5px] leading-relaxed text-amber-100/80">
            Client email generation is available once at least one client profile exists. The other generation modes already use stored newsletters plus live agent-api calls.
          </div>
        ) : null}
      </section>
    </div>
  );
}

function formatPublishStatus(value?: GeneratedContent["publishStatus"]) {
  switch (value) {
    case "published":
      return "Published";
    case "publishing":
      return "Publishing";
    case "failed":
      return "Failed";
    default:
      return "Draft";
  }
}

function formatCompactDateTime(value?: string) {
  if (!value) return "Not available";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(parsed);
}
