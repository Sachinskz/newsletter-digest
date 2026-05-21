"use client";

import { useEffect, useMemo, useState } from "react";
import { Inbox, LoaderCircle, RefreshCw, Shield } from "lucide-react";
import type { NewsletterEmail, NewsletterSubscription } from "@/lib/types";

interface SystemStatus {
  configured: boolean;
  mailbox: string | null;
  articleCount: number;
  subscriptionCount: number;
  lastSyncAt: string | null;
}

interface SyncResponse {
  inserted?: number;
  summarized?: number;
  totals?: {
    articleCount: number;
    subscriptionCount: number;
    lastSyncAt: string | null;
  };
}

interface LoadState {
  systemStatus: SystemStatus | null;
  subscriptions: NewsletterSubscription[];
  newsletters: NewsletterEmail[];
}

export default function IngestPage() {
  const [state, setState] = useState<LoadState>({
    systemStatus: null,
    subscriptions: [],
    newsletters: [],
  });
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  async function loadState(): Promise<SystemStatus | null> {
    setError(null);
    try {
      const [systemStatusRes, subscriptionsRes, newslettersRes] = await Promise.all([
        fetch("/api/system/status"),
        fetch("/api/subscriptions"),
        fetch("/api/newsletters"),
      ]);

      const [systemStatus, subscriptionsData, newslettersData] = await Promise.all([
        systemStatusRes.ok ? systemStatusRes.json() : null,
        subscriptionsRes.json(),
        newslettersRes.json(),
      ]);

      setState({
        systemStatus,
        subscriptions: subscriptionsData.subscriptions || [],
        newsletters: newslettersData.newsletters || [],
      });
      return systemStatus;
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load ingest status");
      setState({ systemStatus: null, subscriptions: [], newsletters: [] });
      return null;
    } finally {
      setLoading(false);
    }
  }

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(null), 2200);
  }

  async function syncNow() {
    setSyncing(true);
    setError(null);
    try {
      const res = await fetch("/api/system/sync", { method: "POST" });
      const data = await res.json() as SyncResponse & { error?: string };
      if (!res.ok) throw new Error(data.error || "Sync failed");

      setState((current) => ({
        ...current,
        systemStatus: current.systemStatus
          ? {
              ...current.systemStatus,
              articleCount: data.totals?.articleCount ?? current.systemStatus.articleCount + (data.inserted ?? 0),
              subscriptionCount: data.totals?.subscriptionCount ?? current.systemStatus.subscriptionCount,
              lastSyncAt: data.totals?.lastSyncAt ?? new Date().toISOString(),
            }
          : current.systemStatus,
      }));

      showToast(`Synced ${data.inserted ?? 0} new articles`);
      void loadState();
      window.setTimeout(() => {
        void loadState();
      }, 1500);
    } catch (syncError) {
      setError(syncError instanceof Error ? syncError.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  useEffect(() => {
    void loadState().then((status) => {
      if (status?.configured && status.articleCount === 0) {
        void syncNow();
      }
    });
  }, []);

  const pendingCount = useMemo(
    () => state.newsletters.filter((item) => !item.hasBeenSummarized).length,
    [state.newsletters],
  );
  const summarizedCount = useMemo(
    () => state.newsletters.filter((item) => item.hasBeenSummarized).length,
    [state.newsletters],
  );

  if (loading) {
    return (
      <div className="grid grid-cols-12 gap-6 text-[#e7e9ee]">
        <section className="col-span-12 space-y-5 lg:col-span-8">
          <SkeletonCard className="h-[200px]" />
          <SkeletonCard className="h-[320px]" />
        </section>
        <aside className="col-span-12 space-y-4 lg:col-span-4">
          <SkeletonCard className="h-[260px]" />
          <SkeletonCard className="h-[140px]" />
        </aside>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-12 gap-6 text-[#e7e9ee]">
        <section className="col-span-12 lg:col-span-8 space-y-5">
          {/* Source card */}
          <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.03))] p-6">
            <div className="pointer-events-none absolute inset-0 rounded-2xl [background:linear-gradient(135deg,rgba(124,92,255,.6),rgba(44,208,255,.3),transparent_60%)] [mask:linear-gradient(#000_0_0)_content-box,linear-gradient(#000_0_0)] [-webkit-mask:linear-gradient(#000_0_0)_content-box,linear-gradient(#000_0_0)] [mask-composite:exclude] [-webkit-mask-composite:xor] p-px" />
            <div className="relative">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-violet-400/25 bg-violet-500/[0.12]">
                  <Inbox size={22} className="text-violet-200" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[16px] font-semibold text-white">
                      {state.systemStatus?.mailbox || "Shared mailbox"}
                    </span>
                    <span className="inline-flex items-center gap-[6px] rounded-full border border-emerald-400/30 bg-emerald-400/10 px-[10px] py-[3px] text-[11px] font-medium text-emerald-200">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
                      {state.systemStatus?.configured ? "Active" : "Pending setup"}
                    </span>
                  </div>
                  <div className="mt-1 text-[12.5px] text-white/55">
                    Microsoft Graph · app-only auth · read-only · last sync {state.systemStatus?.lastSyncAt ? new Date(state.systemStatus.lastSyncAt).toLocaleString() : "never"}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button className="ingest-btn-primary" type="button" onClick={syncNow} disabled={syncing}>
                      {syncing ? <LoaderCircle size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                      {syncing ? "Syncing..." : "Sync now"}
                    </button>
                  </div>
                </div>
                <div className="hidden shrink-0 flex-col items-end md:flex">
                  <div className="text-[11px] uppercase tracking-wider text-white/40">Articles</div>
                  <div className="text-[22px] font-semibold leading-tight text-white">{state.newsletters.length}</div>
                  <div className="text-[11px] text-white/40">stored</div>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3 border-t border-white/5 pt-5 md:grid-cols-4">
                <Metric label="Senders" value={state.subscriptions.length} />
                <Metric label="Articles" value={state.newsletters.length} accent />
                <Metric label="Pending" value={pendingCount} />
                <Metric label="Summarized" value={summarizedCount} />
              </div>
            </div>
          </div>

          {/* Stored articles list */}
          <div className="rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] p-5 backdrop-blur-[14px]">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <div className="text-[14px] font-medium text-white">Stored articles</div>
                <div className="text-[12px] text-white/50">
                  {state.systemStatus?.mailbox
                    ? `Articles from ${state.systemStatus.mailbox}, available to all team members.`
                    : "Articles synced from the shared mailbox."}
                </div>
              </div>
            </div>

            {state.newsletters.length ? (
              <div className="space-y-2">
                {state.newsletters.map((item) => (
                  <div key={item.id} className="flex items-start gap-3 rounded-lg border border-white/5 bg-white/[0.02] p-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-white/10 bg-white/[0.04] text-[11px] font-medium text-white">
                      {(item.senderName || item.senderEmail || "?")[0]}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[12.5px] font-medium text-white">{item.senderName || item.senderEmail}</span>
                        <span className="text-[11px] text-white/40">{new Date(item.receivedAt).toLocaleString()}</span>
                        <span className={`analyst-chip text-[10px] ${item.hasBeenSummarized ? "analyst-chip-good" : "analyst-chip-warn"}`}>
                          {item.hasBeenSummarized ? "Summarized" : "Unreviewed"}
                        </span>
                      </div>
                      <div className="mt-1 text-[13.5px] font-medium leading-snug text-white">{item.subject}</div>
                      <div className="mt-1 line-clamp-2 text-[12.5px] leading-relaxed text-white/55">{item.bodyPlainText}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-white/5 bg-white/[0.02] p-4 text-[12.5px] text-white/55">
                No articles yet. Click Sync now to pull newsletters from the shared mailbox.
              </div>
            )}
          </div>
        </section>

        <aside className="col-span-12 space-y-4 lg:col-span-4">
          <div className="rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] p-5 backdrop-blur-[14px]">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-[13px] font-medium text-white">Discovered senders</div>
              <span className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.03] px-[10px] py-[3px] text-[10px] font-medium text-white/55">
                {state.subscriptions.length}
              </span>
            </div>

            {state.subscriptions.length ? (
              <div className="max-h-[420px] space-y-2.5 overflow-y-auto pr-2">
                {state.subscriptions.map((source) => (
                  <div key={source.id} className="rounded-lg border border-white/5 bg-white/[0.02] p-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="truncate text-[12.5px] font-medium text-white">{source.senderName || source.senderEmail}</div>
                      <span className={`analyst-chip text-[10px] ${source.isActive ? "analyst-chip-good" : "analyst-chip-warn"}`}>
                        {source.isActive ? "Active" : "Paused"}
                      </span>
                    </div>
                    <div className="truncate text-[11px] text-white/45">{source.senderEmail}</div>
                    <div className="mt-1.5 flex items-center justify-between text-[11px] text-white/45">
                      <span>{new Date(source.lastEmailAt).toLocaleDateString()}</span>
                      <span className="tabular-nums text-white/55">{source.emailCount} total</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-white/5 bg-white/[0.02] p-4 text-[12.5px] text-white/55">
                Senders will appear after the first successful sync.
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] p-5 backdrop-blur-[14px]">
            <div className="mb-2 flex items-center gap-2 text-[13px] font-medium text-white">
              <Shield size={13} className="text-emerald-300" />
              How it works
            </div>
            <ul className="space-y-2 text-[12.5px] leading-relaxed text-white/65">
              <li>• Articles are pulled from the shared mailbox using app-only Microsoft Graph access.</li>
              <li>• No personal Microsoft login is needed to read articles.</li>
              <li>• All team members see the same article feed.</li>
              <li>• Each article is automatically summarized by the AI analyst agent.</li>
            </ul>
          </div>
        </aside>
      </div>

      {error ? (
        <div className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-xl border border-red-400/25 bg-red-400/10 px-4 py-3 text-[12.5px] text-red-100 shadow-[0_18px_60px_rgba(0,0,0,0.35)] backdrop-blur-xl">
          {error}
        </div>
      ) : null}

      {toast ? (
        <div className="fixed bottom-5 right-5 z-50 rounded-xl border border-white/10 bg-[#0d1017]/95 px-4 py-3 text-[12.5px] text-white shadow-[0_18px_60px_rgba(0,0,0,0.35)] backdrop-blur-xl">
          {toast}
        </div>
      ) : null}
    </>
  );
}

function Metric({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className={`rounded-lg border p-3 ${accent ? "border-violet-400/20 bg-violet-500/[0.08]" : "border-white/5 bg-white/[0.02]"}`}>
      <div className="text-[11px] uppercase tracking-wider text-white/40">{label}</div>
      <div className="mt-1 text-[20px] font-semibold leading-none text-white">{value}</div>
    </div>
  );
}

function SkeletonCard({ className = "" }: { className?: string }) {
  return (
    <div className={`rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] p-6 ${className}`}>
      <div className="animate-pulse space-y-4">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-white/[0.06]" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-48 rounded bg-white/[0.06]" />
            <div className="h-3 w-72 rounded bg-white/[0.04]" />
          </div>
        </div>
        <div className="grid grid-cols-4 gap-3">
          <div className="h-16 rounded-lg bg-white/[0.04]" />
          <div className="h-16 rounded-lg bg-white/[0.04]" />
          <div className="h-16 rounded-lg bg-white/[0.04]" />
          <div className="h-16 rounded-lg bg-white/[0.04]" />
        </div>
      </div>
    </div>
  );
}
