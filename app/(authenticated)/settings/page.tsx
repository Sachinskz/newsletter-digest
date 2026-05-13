"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Check, KeyRound, LoaderCircle, MailCheck, ShieldCheck, SlidersHorizontal } from "lucide-react";
import { DEFAULT_SUMMARY_FORMAT, getSummaryFormatOption, SUMMARY_FORMAT_OPTIONS } from "@/lib/summarization";
import type { NewsletterPreferences, SummaryFormat } from "@/lib/types";

interface ConnectionResponse {
  connected: boolean;
  accountEmail?: string;
  accountName?: string;
  status?: string;
  accessTokenExpiresAt?: string;
  connectedAt?: string;
  lastSyncAt?: string;
}

interface PreferencesResponse {
  preferences: NewsletterPreferences | null;
  hasPreferences: boolean;
  summaryFormat: SummaryFormat;
}

export default function SettingsPage() {
  const [connection, setConnection] = useState<ConnectionResponse | null>(null);
  const [preferences, setPreferences] = useState<PreferencesResponse | null>(null);
  const [selectedFormat, setSelectedFormat] = useState<SummaryFormat>(DEFAULT_SUMMARY_FORMAT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadSettings() {
    setError(null);
    try {
      const [statusRes, preferencesRes] = await Promise.all([fetch("/api/oauth/status"), fetch("/api/preferences")]);
      const statusData = await statusRes.json();
      const preferencesData = await preferencesRes.json();
      if (!statusRes.ok) throw new Error(statusData.error || "Could not load Microsoft connection");
      if (!preferencesRes.ok) throw new Error(preferencesData.error || "Could not load preferences");
      setConnection(statusData);
      setPreferences(preferencesData);
      setSelectedFormat(preferencesData.summaryFormat || DEFAULT_SUMMARY_FORMAT);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load settings");
    } finally {
      setLoading(false);
    }
  }

  async function saveFormat() {
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ summaryFormat: selectedFormat }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save format");
      setPreferences(data);
      setMessage("Summary format saved.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save format");
    } finally {
      setSaving(false);
    }
  }

  async function disconnect() {
    setDisconnecting(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/oauth/disconnect", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not disconnect Microsoft 365");
      setMessage("Microsoft 365 disconnected. Stored newsletters, summaries, and generated drafts remain in Busibox.");
      await loadSettings();
    } catch (disconnectError) {
      setError(disconnectError instanceof Error ? disconnectError.message : "Could not disconnect Microsoft 365");
    } finally {
      setDisconnecting(false);
    }
  }

  useEffect(() => {
    void loadSettings();
  }, []);

  const selectedOption = getSummaryFormatOption(selectedFormat);
  const prototypeMailbox = "newsletters@maigent.ai";

  if (loading) {
    return <div className="analyst-glass rounded-2xl p-8 text-[13px] text-white/55">Loading settings...</div>;
  }

  return (
    <div className="grid grid-cols-12 gap-6 text-[#e7e9ee]">
      <section className="col-span-12 space-y-5 lg:col-span-8">
        <div className="analyst-glass rounded-2xl p-5">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-[10px] py-[3px] text-[11px] font-medium text-white/55">
                <MailCheck size={12} />
                Microsoft 365
              </div>
              <div className="text-[16px] font-semibold text-white">
                {connection?.connected ? connection.accountEmail || "Microsoft account connected" : "Connect Microsoft 365"}
              </div>
              <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed text-white/60">
                The app uses Microsoft Graph for read-only newsletter sync. Tokens are encrypted through the Busibox AuthZ keystore and are never sent to the browser.
              </p>
            </div>
            <span className={`analyst-chip ${connection?.connected ? "analyst-chip-good" : "analyst-chip-warn"}`}>
              {connection?.connected ? "Connected" : "Disconnected"}
            </span>
          </div>

          <dl className="grid gap-3 border-t border-white/5 pt-4 sm:grid-cols-2 lg:grid-cols-3">
            <Fact label="Status" value={connection?.status || (connection?.connected ? "active" : "disconnected")} />
            <Fact label="Connected" value={formatDateTime(connection?.connectedAt)} />
            <Fact label="Last sync" value={formatDateTime(connection?.lastSyncAt)} />
            <Fact label="Token expires" value={formatDateTime(connection?.accessTokenExpiresAt)} />
            <Fact label="Account name" value={connection?.accountName || "Not available"} />
            <Fact label="Storage" value="Personal data-api" />
          </dl>

          <div className="mt-5 flex flex-wrap gap-2">
            <Link href="/api/oauth/authorize" className="analyst-btn analyst-btn-primary">
              {connection?.connected ? "Reconnect Microsoft" : "Connect Microsoft"}
            </Link>
            <Link
              href={`/api/oauth/authorize?mailbox=${encodeURIComponent(prototypeMailbox)}&prompt=login`}
              className="analyst-btn"
            >
              Use {prototypeMailbox}
            </Link>
            <button className="analyst-btn" type="button" onClick={disconnect} disabled={!connection?.connected || disconnecting}>
              {disconnecting ? <LoaderCircle size={13} className="animate-spin" /> : null}
              Disconnect
            </button>
          </div>
        </div>

        <div className="analyst-glass rounded-2xl p-5">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-[10px] py-[3px] text-[11px] font-medium text-white/55">
                <SlidersHorizontal size={12} />
                Summary format
              </div>
              <div className="text-[16px] font-semibold text-white">{selectedOption.title}</div>
              <p className="mt-1.5 text-[13px] leading-relaxed text-white/60">
                New AI summaries use this preference before the agent runs. Existing summaries keep their original format.
              </p>
            </div>
            <button className="analyst-btn analyst-btn-primary" type="button" onClick={saveFormat} disabled={saving}>
              {saving ? <LoaderCircle size={13} className="animate-spin" /> : <Check size={13} />}
              Save format
            </button>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {SUMMARY_FORMAT_OPTIONS.map((option) => {
              const active = selectedFormat === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setSelectedFormat(option.id)}
                  className={`min-h-[128px] rounded-lg border p-4 text-left transition ${
                    active ? "border-violet-400/55 bg-violet-500/10" : "border-white/5 bg-white/[0.02] hover:bg-white/[0.04]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-[14px] font-medium text-white">{option.title}</div>
                    {active ? <Check size={15} className="text-violet-200" /> : null}
                  </div>
                  <p className="mt-1.5 text-[12.5px] leading-relaxed text-white/55">{option.description}</p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {option.preview.slice(0, 2).map((line) => (
                      <span key={line} className="analyst-chip text-[10px]">
                        {line}
                      </span>
                    ))}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {message ? <div className="rounded-xl border border-emerald-400/25 bg-emerald-400/10 px-4 py-3 text-[13px] text-emerald-100">{message}</div> : null}
        {error ? <div className="rounded-xl border border-red-400/25 bg-red-400/10 px-4 py-3 text-[13px] text-red-100">{error}</div> : null}
      </section>

      <aside className="col-span-12 space-y-3 lg:col-span-4">
        <TrustCard icon={ShieldCheck} title="User-owned encryption" body="Keystore encryption includes the Busibox user id so token decrypt is scoped to the same authenticated user." />
        <TrustCard icon={KeyRound} title="No plaintext tokens" body="Access and refresh tokens are encrypted server-side before any connection metadata is persisted." />
        <TrustCard icon={MailCheck} title="Production OAuth path" body="Once the portal owner registers the redirect URI and secret, Microsoft Graph sync can run end to end." />
      </aside>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/5 bg-white/[0.02] p-3">
      <dt className="text-[10px] uppercase tracking-wider text-white/35">{label}</dt>
      <dd className="mt-1 truncate text-[13px] font-medium text-white">{value}</dd>
    </div>
  );
}

function TrustCard({ icon: Icon, title, body }: { icon: typeof ShieldCheck; title: string; body: string }) {
  return (
    <div className="analyst-glass rounded-2xl p-5">
      <Icon className="h-5 w-5 text-[#b1e9ff]" />
      <h3 className="mt-3 text-[13px] font-medium text-white">{title}</h3>
      <p className="mt-2 text-[12.5px] leading-relaxed text-white/55">{body}</p>
    </div>
  );
}

function formatDateTime(value?: string): string {
  return value ? new Date(value).toLocaleString() : "Not available";
}
