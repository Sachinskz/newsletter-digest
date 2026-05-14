"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Clipboard, Linkedin, LoaderCircle, Mail, MessageSquareText, PenLine, RefreshCw, Send, Sparkles, TrendingUp } from "lucide-react";
import {
  deriveLibraryArticles,
  type LibraryArticle,
} from "@/lib/editorial-intelligence";
import { CONTENT_KINDS, CONTENT_TONES, getContentKindLabel } from "@/lib/content-generation";
import type { ContentKind, ContentTone, GeneratedContent, NewsletterClientProfile, NewsletterEmail, NewsletterSummary } from "@/lib/types";

const KIND_ICONS: Record<ContentKind, typeof Linkedin> = {
  linkedin: Linkedin,
  email: Mail,
  thought: Sparkles,
  newsletter: PenLine,
  talking: MessageSquareText,
  investor: TrendingUp,
};

export default function GeneratePage() {
  const [articles, setArticles] = useState<LibraryArticle[]>([]);
  const [clients, setClients] = useState<NewsletterClientProfile[]>([]);
  const [recentDrafts, setRecentDrafts] = useState<GeneratedContent[]>([]);
  const [articleId, setArticleId] = useState("");
  const [clientId, setClientId] = useState("");
  const [kind, setKind] = useState<ContentKind>("linkedin");
  const [tone, setTone] = useState<ContentTone>("Analytical");
  const [generated, setGenerated] = useState<GeneratedContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    async function load() {
      setError(null);
      try {
        const [newslettersRes, summariesRes, contentRes, clientsRes] = await Promise.all([
          fetch("/api/newsletters"),
          fetch("/api/summaries"),
          fetch("/api/content"),
          fetch("/api/clients"),
        ]);
        const newslettersData = await newslettersRes.json();
        const summariesData = await summariesRes.json();
        const contentData = await contentRes.json();
        const clientsData = await clientsRes.json();

        if (!alive) return;

        const nextArticles = deriveLibraryArticles(
          (newslettersData.newsletters || []) as NewsletterEmail[],
          (summariesData.summaries || []) as NewsletterSummary[],
        );
        const nextClients = (clientsData.clients || []) as NewsletterClientProfile[];
        setArticles(nextArticles);
        setClients(nextClients);
        const params = new URLSearchParams(window.location.search);
        const requestedArticle = params.get("article");
        const requestedKind = params.get("kind");
        setArticleId(nextArticles.some((item) => item.id === requestedArticle) ? requestedArticle || "" : nextArticles[0]?.id || "");
        if (CONTENT_KINDS.some((item) => item.id === requestedKind && (!item.needsClient || nextClients.length > 0))) {
          setKind(requestedKind as ContentKind);
        }
        setClientId(nextClients[0]?.id || "");
        setRecentDrafts(contentData.content || []);
      } catch (loadError) {
        if (!alive) return;
        setArticles([]);
        setClients([]);
        setArticleId("");
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

  const article = useMemo(() => articles.find((item) => item.id === articleId) || articles[0], [articleId, articles]);
  const selectedClient = useMemo(() => clients.find((item) => item.id === clientId) || clients[0] || null, [clientId, clients]);
  const selectedKind = CONTENT_KINDS.find((item) => item.id === kind) || CONTENT_KINDS[0];
  const availableKinds = CONTENT_KINDS.filter((item) => !item.needsClient || clients.length > 0);

  async function generate() {
    if (!article) return;
    if (selectedKind.needsClient && !selectedClient) {
      setError("Create a client profile first, then select it for client-email generation.");
      return;
    }
    setGenerating(true);
    setGenerated(null);
    setError(null);
    try {
      const res = await fetch("/api/content/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          article,
          kind,
          tone,
          client: selectedKind.needsClient ? selectedClient : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not generate content");
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

  return (
    <div className="grid grid-cols-12 gap-6 text-[#e7e9ee]">
      <section className="col-span-12 space-y-4 lg:col-span-4">
        <div className="analyst-glass rounded-2xl p-5">
          <div className="mb-3 text-[13px] font-medium text-white">1. Pick an article</div>
          <select className="analyst-select" value={articleId} onChange={(event) => setArticleId(event.target.value)} disabled={loading}>
            {articles.map((item) => (
              <option key={item.id} value={item.id}>
                {item.title.slice(0, 86)}
              </option>
            ))}
          </select>
          {article ? (
            <div className="mt-3 rounded-lg border border-white/5 bg-white/[0.03] p-3">
              <span className="analyst-chip analyst-chip-accent mb-2">{article.category}</span>
              <div className="mt-2 text-[12.5px] leading-relaxed text-white/70">{article.summary}</div>
            </div>
          ) : (
            <div className="mt-3 rounded-lg border border-white/5 bg-white/[0.03] p-3 text-[12.5px] leading-relaxed text-white/55">
              No real articles are available yet. Sync newsletters first, then generation will unlock from stored stories.
            </div>
          )}
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
                <button className="analyst-btn" type="button" onClick={copyDraft} disabled={!generated}>
                  {copied ? <Check size={13} /> : <Clipboard size={13} />}
                  {copied ? "Copied" : "Copy"}
                </button>
                <button className="analyst-btn analyst-btn-primary" type="button" onClick={generate} disabled={!article || generating}>
                  {generating ? <LoaderCircle size={13} className="animate-spin" /> : <Send size={13} />}
                  {generating ? "Generating..." : generated ? "Regenerate" : "Generate"}
                </button>
              </div>
            </div>

            {generated ? (
              generated.kind === "email" ? (
                <>
                  <div className="mb-3 border-b border-white/5 pb-3">
                    <div className="mb-1 text-[11px] uppercase tracking-wider text-white/40">Subject</div>
                    <div className="text-[14px] font-medium text-white">{generated.subject}</div>
                  </div>
                  <div className="whitespace-pre-wrap text-[13.5px] leading-relaxed text-white/85">{generated.body}</div>
                </>
              ) : (
                <div className="whitespace-pre-wrap text-[13.5px] leading-relaxed text-white/85">{generated.body}</div>
              )
            ) : (
              <div className="rounded-xl border border-white/5 bg-white/[0.02] p-6 text-[13px] leading-relaxed text-white/55">
                {loading ? "Loading generator context..." : "Choose a real article and an enabled output type, then generate a draft."}
              </div>
            )}

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
                  onClick={() => setGenerated(draft)}
                  className="flex w-full items-center gap-3 rounded-lg border border-white/5 bg-white/[0.02] p-2.5 text-left transition hover:bg-white/[0.04]"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-white/[0.04] text-[11px] font-medium text-white">
                    {draft.kind.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-medium text-white">{draft.title}</div>
                    <div className="truncate text-[11px] text-white/42">{draft.articleTitle}</div>
                  </div>
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
