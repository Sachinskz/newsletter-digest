"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { Check, Inbox, KeyRound, Linkedin, LoaderCircle, MailCheck, ShieldCheck, SlidersHorizontal } from "lucide-react";
import { DEFAULT_SUMMARY_FORMAT, getSummaryFormatOption, SUMMARY_FORMAT_OPTIONS } from "@/lib/summarization";
import type { NewsletterPreferences, SummaryFormat } from "@/lib/types";

interface MicrosoftConnectionResponse {
  connected: boolean;
  accountEmail?: string;
  accountName?: string;
  status?: string;
  accessTokenExpiresAt?: string;
  connectedAt?: string;
  lastSyncAt?: string;
}

interface LinkedInConnectionResponse {
  connected: boolean;
  memberId?: string;
  memberName?: string;
  memberEmail?: string;
  status?: string;
  accessTokenExpiresAt?: string;
  connectedAt?: string;
  lastUsedAt?: string;
}

interface PreferencesResponse {
  preferences: NewsletterPreferences | null;
  hasPreferences: boolean;
  summaryFormat: SummaryFormat;
}

export default function SettingsPage() {
  const [microsoftConnection, setMicrosoftConnection] = useState<MicrosoftConnectionResponse | null>(null);
  const [linkedInConnection, setLinkedInConnection] = useState<LinkedInConnectionResponse | null>(null);
  const [preferences, setPreferences] = useState<PreferencesResponse | null>(null);
  const [selectedFormat, setSelectedFormat] = useState<SummaryFormat>(DEFAULT_SUMMARY_FORMAT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [disconnectingMicrosoft, setDisconnectingMicrosoft] = useState(false);
  const [disconnectingLinkedIn, setDisconnectingLinkedIn] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sharedMailboxConfig, setSharedMailboxConfig] = useState<Record<string, string>>({});
  const [msForm, setMsForm] = useState({ MS_CLIENT_ID: "", MS_CLIENT_SECRET: "", MS_TENANT_ID: "", MS_SHARED_MAILBOX: "" });
  const [savingMs, setSavingMs] = useState(false);
  const [msMessage, setMsMessage] = useState<string | null>(null);

  async function loadSettings() {
    setError(null);
    try {
      const [microsoftRes, linkedInRes, preferencesRes, msConfigRes] = await Promise.all([
        fetch("/api/oauth/status"),
        fetch("/api/linkedin/status"),
        fetch("/api/preferences"),
        fetch("/api/system/config"),
      ]);
      const microsoftData = await microsoftRes.json();
      const linkedInData = await linkedInRes.json();
      const preferencesData = await preferencesRes.json();
      const msConfigData = msConfigRes.ok ? await msConfigRes.json() : { keys: {} };

      if (!microsoftRes.ok) throw new Error(microsoftData.error || "Could not load Microsoft connection");
      if (!linkedInRes.ok) throw new Error(linkedInData.error || "Could not load LinkedIn connection");
      if (!preferencesRes.ok) throw new Error(preferencesData.error || "Could not load preferences");

      setMicrosoftConnection(microsoftData);
      setLinkedInConnection(linkedInData);
      setSharedMailboxConfig(msConfigData.keys || {});
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

  async function disconnectMicrosoft() {
    setDisconnectingMicrosoft(true);
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
      setDisconnectingMicrosoft(false);
    }
  }

  async function disconnectLinkedIn() {
    setDisconnectingLinkedIn(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/linkedin/disconnect", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not disconnect LinkedIn");
      setMessage("LinkedIn disconnected. Existing generated drafts remain available and can still be copied manually.");
      await loadSettings();
    } catch (disconnectError) {
      setError(disconnectError instanceof Error ? disconnectError.message : "Could not disconnect LinkedIn");
    } finally {
      setDisconnectingLinkedIn(false);
    }
  }

  useEffect(() => {
    void loadSettings();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const linkedInState = params.get("linkedin");
    const oauthState = params.get("oauth");
    const connected = params.get("connected");
    const reason = params.get("reason");

    if (linkedInState === "connected") {
      setMessage("LinkedIn connected. You can now publish LinkedIn drafts directly from the generator.");
      return;
    }
    if (linkedInState === "config-error") {
      setError(reason || "LinkedIn OAuth is not configured yet. Add the LinkedIn app credentials and redirect URI first.");
      return;
    }
    if (linkedInState === "error") {
      setError(reason || "LinkedIn sign-in failed.");
      return;
    }
    if (connected === "1") {
      setMessage("Microsoft 365 connected.");
      return;
    }
    if (oauthState === "error") {
      setError(reason || "Microsoft sign-in failed.");
    }
  }, []);

  const selectedOption = getSummaryFormatOption(selectedFormat);
  const prototypeMailbox = "newsletters@maigent.ai";

  if (loading) {
    return <div className="analyst-glass rounded-2xl p-8 text-[13px] text-white/55">Loading settings...</div>;
  }

  return (
    <div className="grid grid-cols-12 gap-6 text-[#e7e9ee]">
      <section className="col-span-12 space-y-5 lg:col-span-8">
        <ConnectionCard
          badge="Microsoft 365"
          icon={MailCheck}
          connected={Boolean(microsoftConnection?.connected)}
          title={
            microsoftConnection?.connected
              ? microsoftConnection.accountEmail || "Microsoft account connected"
              : "Connect Microsoft 365"
          }
          description="The app uses Microsoft Graph for read-only newsletter sync. Tokens are encrypted through the Busibox AuthZ keystore and are never sent to the browser."
          facts={[
            { label: "Status", value: microsoftConnection?.status || (microsoftConnection?.connected ? "active" : "disconnected") },
            { label: "Connected", value: formatDateTime(microsoftConnection?.connectedAt) },
            { label: "Last sync", value: formatDateTime(microsoftConnection?.lastSyncAt) },
            { label: "Token expires", value: formatDateTime(microsoftConnection?.accessTokenExpiresAt) },
            { label: "Account name", value: microsoftConnection?.accountName || "Not available" },
            { label: "Storage", value: "Personal data-api" },
          ]}
          actions={
            <>
              <Link href="/api/oauth/authorize" className="analyst-btn analyst-btn-primary">
                {microsoftConnection?.connected ? "Reconnect Microsoft" : "Connect Microsoft"}
              </Link>
              <Link
                href={`/api/oauth/authorize?mailbox=${encodeURIComponent(prototypeMailbox)}&prompt=login`}
                className="analyst-btn"
              >
                Use {prototypeMailbox}
              </Link>
              <button
                className="analyst-btn"
                type="button"
                onClick={disconnectMicrosoft}
                disabled={!microsoftConnection?.connected || disconnectingMicrosoft}
              >
                {disconnectingMicrosoft ? <LoaderCircle size={13} className="animate-spin" /> : null}
                Disconnect
              </button>
            </>
          }
        />

        <ConnectionCard
          badge="LinkedIn"
          icon={Linkedin}
          connected={Boolean(linkedInConnection?.connected)}
          title={
            linkedInConnection?.connected
              ? linkedInConnection.memberEmail || linkedInConnection.memberName || "LinkedIn connected"
              : "Connect LinkedIn for direct publishing"
          }
          description="Connect a personal LinkedIn profile to publish generated LinkedIn drafts directly from Newsletter Digest. This v1 supports profile posting only."
          facts={[
            { label: "Status", value: linkedInConnection?.status || (linkedInConnection?.connected ? "active" : "disconnected") },
            { label: "Connected", value: formatDateTime(linkedInConnection?.connectedAt) },
            { label: "Last used", value: formatDateTime(linkedInConnection?.lastUsedAt) },
            { label: "Token expires", value: formatDateTime(linkedInConnection?.accessTokenExpiresAt) },
            { label: "Member name", value: linkedInConnection?.memberName || "Not available" },
            { label: "Target", value: "Personal profile" },
          ]}
          actions={
            <>
              <Link href="/api/linkedin/authorize" className="analyst-btn analyst-btn-primary">
                {linkedInConnection?.connected ? "Reconnect LinkedIn" : "Connect LinkedIn"}
              </Link>
              <Link href="/api/linkedin/authorize?prompt=login" className="analyst-btn">
                Switch LinkedIn account
              </Link>
              <button
                className="analyst-btn"
                type="button"
                onClick={disconnectLinkedIn}
                disabled={!linkedInConnection?.connected || disconnectingLinkedIn}
              >
                {disconnectingLinkedIn ? <LoaderCircle size={13} className="animate-spin" /> : null}
                Disconnect
              </button>
            </>
          }
        />

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

        <div className="analyst-glass rounded-2xl p-5">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-[10px] py-[3px] text-[11px] font-medium text-white/55">
                <Inbox size={12} />
                Shared Mailbox
              </div>
              <div className="text-[16px] font-semibold text-white">Shared mailbox credentials</div>
              <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed text-white/60">
                Configure the Azure AD app registration credentials for reading the shared mailbox. These are stored encrypted in the Config API and used by all team members.
              </p>
            </div>
            <span className={`analyst-chip ${Object.values(sharedMailboxConfig).every((v) => v === "configured") ? "analyst-chip-good" : "analyst-chip-warn"}`}>
              {Object.values(sharedMailboxConfig).every((v) => v === "configured") ? "Configured" : "Needs setup"}
            </span>
          </div>

          <div className="space-y-3 border-t border-white/5 pt-4">
            {(["MS_CLIENT_ID", "MS_TENANT_ID", "MS_SHARED_MAILBOX", "MS_CLIENT_SECRET"] as const).map((key) => (
              <div key={key}>
                <div className="mb-1 flex items-center justify-between">
                  <label htmlFor={key} className="text-[12px] font-medium text-white/70">{key}</label>
                  {sharedMailboxConfig[key] === "configured" ? (
                    <span className="text-[10px] text-emerald-300">configured</span>
                  ) : (
                    <span className="text-[10px] text-amber-300">missing</span>
                  )}
                </div>
                <input
                  id={key}
                  type={key === "MS_CLIENT_SECRET" ? "password" : "text"}
                  className="analyst-input w-full"
                  placeholder={key === "MS_SHARED_MAILBOX" ? "newsletters@maigent.ai" : key === "MS_TENANT_ID" ? "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" : ""}
                  value={msForm[key]}
                  onChange={(e) => setMsForm((prev) => ({ ...prev, [key]: e.target.value }))}
                />
              </div>
            ))}
          </div>

          <div className="mt-4 flex items-center gap-3">
            <button
              className="analyst-btn analyst-btn-primary"
              type="button"
              disabled={savingMs || !Object.values(msForm).some((v) => v.trim())}
              onClick={async () => {
                setSavingMs(true);
                setMsMessage(null);
                setError(null);
                try {
                  const body = Object.fromEntries(
                    Object.entries(msForm).filter(([, v]) => v.trim()),
                  );
                  const res = await fetch("/api/system/config", {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(body),
                  });
                  const data = await res.json();
                  if (!res.ok) throw new Error(data.error || "Failed to save");
                  setMsMessage("Shared mailbox credentials saved. Go to Ingest and click Sync.");
                  setMsForm({ MS_CLIENT_ID: "", MS_CLIENT_SECRET: "", MS_TENANT_ID: "", MS_SHARED_MAILBOX: "" });
                  await loadSettings();
                } catch (saveError) {
                  setError(saveError instanceof Error ? saveError.message : "Failed to save credentials");
                } finally {
                  setSavingMs(false);
                }
              }}
            >
              {savingMs ? <LoaderCircle size={13} className="animate-spin" /> : null}
              {savingMs ? "Saving..." : "Save credentials"}
            </button>
            {msMessage ? <span className="text-[12px] text-emerald-300">{msMessage}</span> : null}
          </div>
        </div>

        {message ? <div className="rounded-xl border border-emerald-400/25 bg-emerald-400/10 px-4 py-3 text-[13px] text-emerald-100">{message}</div> : null}
        {error ? <div className="rounded-xl border border-red-400/25 bg-red-400/10 px-4 py-3 text-[13px] text-red-100">{error}</div> : null}
      </section>

      <aside className="col-span-12 space-y-3 lg:col-span-4">
        <TrustCard icon={ShieldCheck} title="User-owned encryption" body="Keystore encryption includes the Busibox user id so token decrypt is scoped to the same authenticated user." />
        <TrustCard icon={KeyRound} title="No plaintext tokens" body="Access and refresh tokens are encrypted server-side before any connection metadata is persisted." />
        <TrustCard icon={MailCheck} title="Production OAuth path" body="Once the portal owner registers the redirect URI and secret, Microsoft Graph sync can run end to end." />
        <TrustCard icon={Linkedin} title="Direct publish only" body="LinkedIn v1 is intentionally limited to personal profile publishing. Inbox, history sync, and tone-memory stay out of scope for now." />
      </aside>
    </div>
  );
}

function ConnectionCard({
  badge,
  icon: Icon,
  connected,
  title,
  description,
  facts,
  actions,
}: {
  badge: string;
  icon: typeof MailCheck;
  connected: boolean;
  title: string;
  description: string;
  facts: Array<{ label: string; value: string }>;
  actions: ReactNode;
}) {
  return (
    <div className="analyst-glass rounded-2xl p-5">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-[10px] py-[3px] text-[11px] font-medium text-white/55">
            <Icon size={12} />
            {badge}
          </div>
          <div className="text-[16px] font-semibold text-white">{title}</div>
          <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed text-white/60">{description}</p>
        </div>
        <span className={`analyst-chip ${connected ? "analyst-chip-good" : "analyst-chip-warn"}`}>
          {connected ? "Connected" : "Disconnected"}
        </span>
      </div>

      <dl className="grid gap-3 border-t border-white/5 pt-4 sm:grid-cols-2 lg:grid-cols-3">
        {facts.map((fact) => (
          <Fact key={fact.label} label={fact.label} value={fact.value} />
        ))}
      </dl>

      <div className="mt-5 flex flex-wrap gap-2">{actions}</div>
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
