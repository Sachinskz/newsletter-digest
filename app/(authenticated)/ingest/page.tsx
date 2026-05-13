"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Check, Link2, LoaderCircle, Mail, RefreshCw, Shield } from "lucide-react";
import type { NewsletterEmail, NewsletterSubscription } from "@/lib/types";

interface ConnectionResponse {
  connected: boolean;
  accountEmail?: string;
  accountName?: string;
  status?: string;
  lastSyncAt?: string;
  accessTokenExpiresAt?: string;
}

interface LoadState {
  connection: ConnectionResponse | null;
  subscriptions: NewsletterSubscription[];
  newsletters: NewsletterEmail[];
}

export default function IngestPage() {
  const [state, setState] = useState<LoadState>({
    connection: null,
    subscriptions: [],
    newsletters: [],
  });
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  async function loadState() {
    setError(null);
    try {
      const [connectionRes, subscriptionsRes, newslettersRes] = await Promise.all([
        fetch("/api/oauth/status"),
        fetch("/api/subscriptions"),
        fetch("/api/newsletters"),
      ]);

      const [connection, subscriptionsData, newslettersData] = await Promise.all([
        connectionRes.json(),
        subscriptionsRes.json(),
        newslettersRes.json(),
      ]);

      if (!connectionRes.ok) throw new Error(connection.error || "Could not load Microsoft connection");
      if (!subscriptionsRes.ok) throw new Error(subscriptionsData.error || "Could not load subscriptions");
      if (!newslettersRes.ok) throw new Error(newslettersData.error || "Could not load newsletters");

      setState({
        connection,
        subscriptions: subscriptionsData.subscriptions || [],
        newsletters: newslettersData.newsletters || [],
      });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load ingest status");
      setState({
        connection: null,
        subscriptions: [],
        newsletters: [],
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadState();
  }, []);

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(null), 2200);
  }

  async function syncNow() {
    setSyncing(true);
    setError(null);
    try {
      const res = await fetch("/api/newsletters/sync", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Sync failed");
      await loadState();
      showToast(`Synced ${data.insertedCount ?? 0} new newsletters`);
    } catch (syncError) {
      setError(syncError instanceof Error ? syncError.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  async function disconnect() {
    setDisconnecting(true);
    setError(null);
    try {
      const res = await fetch("/api/oauth/disconnect", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Disconnect failed");
      await loadState();
      showToast("Microsoft mailbox disconnected");
    } catch (disconnectError) {
      setError(disconnectError instanceof Error ? disconnectError.message : "Disconnect failed");
    } finally {
      setDisconnecting(false);
    }
  }

  const pendingCount = useMemo(
    () => state.newsletters.filter((item) => !item.hasBeenSummarized).length,
    [state.newsletters],
  );
  const summarizedCount = useMemo(
    () => state.newsletters.filter((item) => item.hasBeenSummarized).length,
    [state.newsletters],
  );

  return (
    <>
      <div className="grid grid-cols-12 gap-6 text-[#e7e9ee]">
        <section className="col-span-12 lg:col-span-8 space-y-5">
          <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.03))] p-6">
            <div className="pointer-events-none absolute inset-0 rounded-2xl [background:linear-gradient(135deg,rgba(124,92,255,.6),rgba(44,208,255,.3),transparent_60%)] [mask:linear-gradient(#000_0_0)_content-box,linear-gradient(#000_0_0)] [-webkit-mask:linear-gradient(#000_0_0)_content-box,linear-gradient(#000_0_0)] [mask-composite:exclude] [-webkit-mask-composite:xor] p-px" />
            {loading ? (
              <div className="relative text-[13px] text-white/55">Loading Microsoft connection...</div>
            ) : !state.connection?.connected ? (
              <div className="relative flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04]">
                  <Mail size={22} />
                </div>
                <div className="flex-1">
                  <div className="text-[16px] font-semibold text-white">Connect your Microsoft 365 inbox</div>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-white/60">
                    This page now shows only real ingest state. Once a mailbox is connected, sync will pull newsletters from Microsoft Graph and store them here.
                  </p>
                  <a
                    href="/api/oauth/authorize"
                    className="mt-4 inline-flex items-center gap-2 rounded-[10px] border border-[#7c5cff]/60 bg-[linear-gradient(135deg,#7c5cff,#5b3df5)] px-[14px] py-[8px] text-[13px] font-medium text-white shadow-[0_6px_24px_-8px_rgba(124,92,255,.6)]"
                  >
                    <Mail size={14} />
                    Connect Microsoft 365
                  </a>
                </div>
              </div>
            ) : (
              <div className="relative">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04]">
                    <Mail size={22} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[16px] font-semibold text-white">{state.connection.accountEmail || "Microsoft 365 inbox"}</span>
                      <span className="inline-flex items-center gap-[6px] rounded-full border border-emerald-400/30 bg-emerald-400/10 px-[10px] py-[3px] text-[11px] font-medium text-emerald-200">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
                        Connected
                      </span>
                    </div>
                    <div className="mt-1 text-[12.5px] text-white/55">
                      Microsoft 365 · OAuth · read-only · last sync {state.connection.lastSyncAt ? new Date(state.connection.lastSyncAt).toLocaleString() : "not available"}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button className="ingest-btn-primary" type="button" onClick={syncNow} disabled={syncing}>
                        {syncing ? <LoaderCircle size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                        {syncing ? "Syncing..." : "Sync now"}
                      </button>
                      <button className="ingest-btn" type="button" onClick={disconnect} disabled={disconnecting}>
                        {disconnecting ? <LoaderCircle size={12} className="animate-spin" /> : <Link2 size={12} />}
                        {disconnecting ? "Disconnecting..." : "Disconnect"}
                      </button>
                      <span className="ingest-btn cursor-default opacity-70">Filters & rules not wired</span>
                    </div>
                  </div>
                  <div className="hidden shrink-0 flex-col items-end md:flex">
                    <div className="text-[11px] uppercase tracking-wider text-white/40">Stored</div>
                    <div className="text-[22px] font-semibold leading-tight text-white">{state.newsletters.length}</div>
                    <div className="text-[11px] text-white/40">newsletters</div>
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-3 border-t border-white/5 pt-5 md:grid-cols-4">
                  <Metric label="Senders" value={state.subscriptions.length} />
                  <Metric label="Stored" value={state.newsletters.length} accent />
                  <Metric label="Pending" value={pendingCount} />
                  <Metric label="Summarized" value={summarizedCount} />
                </div>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] p-5 backdrop-blur-[14px]">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <div className="text-[14px] font-medium text-white">Stored newsletters</div>
                <div className="text-[12px] text-white/50">These are the real newsletter emails currently stored in data-api.</div>
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
                No newsletters are stored yet. Connect Microsoft and run the first sync to see what the ingest pipeline is actually capturing.
              </div>
            )}
          </div>
        </section>

        <aside className="col-span-12 space-y-4 lg:col-span-4">
          <div className="rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] p-5 backdrop-blur-[14px]">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-[13px] font-medium text-white">Connected senders</div>
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
                Sender subscriptions will appear after the first successful sync.
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] p-5 backdrop-blur-[14px]">
            <div className="mb-2 flex items-center gap-2 text-[13px] font-medium text-white">
              <Shield size={13} className="text-emerald-300" />
              Privacy
            </div>
            <ul className="space-y-2 text-[12.5px] leading-relaxed text-white/65">
              <li>• OAuth tokens remain encrypted server-side through AuthZ keystore.</li>
              <li>• The browser only sees connection status and stored newsletter metadata.</li>
              <li>• Manual paste and fake sample inboxes are intentionally removed.</li>
            </ul>
          </div>

          <div className="rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] p-5 backdrop-blur-[14px]">
            <div className="mb-2 flex items-center gap-2 text-[13px] font-medium text-white">
              <AlertCircle size={13} className="text-amber-200" />
              Still missing
            </div>
            <ul className="space-y-2 text-[12.5px] leading-relaxed text-white/60">
              <li>• Rule builder persistence for which senders or folders to ingest.</li>
              <li>• One-off manual ingest flow.</li>
              <li>• Per-newsletter review actions beyond sync and storage.</li>
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
