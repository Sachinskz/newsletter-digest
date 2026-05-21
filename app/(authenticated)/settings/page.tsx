"use client";

import { useEffect, useState } from "react";
import { Check, Inbox, KeyRound, LoaderCircle, MailCheck, ShieldCheck, SlidersHorizontal } from "lucide-react";
import { DEFAULT_SUMMARY_FORMAT, getSummaryFormatOption, SUMMARY_FORMAT_OPTIONS } from "@/lib/summarization";
import type { NewsletterPreferences, SummaryFormat } from "@/lib/types";

interface PreferencesResponse {
  preferences: NewsletterPreferences | null;
  hasPreferences: boolean;
  summaryFormat: SummaryFormat;
}

export default function SettingsPage() {
  const [preferences, setPreferences] = useState<PreferencesResponse | null>(null);
  const [selectedFormat, setSelectedFormat] = useState<SummaryFormat>(DEFAULT_SUMMARY_FORMAT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sharedMailboxConfig, setSharedMailboxConfig] = useState<Record<string, string>>({});
  const [msForm, setMsForm] = useState({ MS_CLIENT_ID: "", MS_CLIENT_SECRET: "", MS_TENANT_ID: "", MS_SHARED_MAILBOX: "" });
  const [savingMs, setSavingMs] = useState(false);
  const [msMessage, setMsMessage] = useState<string | null>(null);

  async function loadSettings() {
    setError(null);
    try {
      const [preferencesRes, msConfigRes] = await Promise.all([
        fetch("/api/preferences"),
        fetch("/api/system/config"),
      ]);
      const preferencesData = preferencesRes.ok ? await preferencesRes.json() : null;
      const msConfigData = msConfigRes.ok ? await msConfigRes.json() : { keys: {} };

      setSharedMailboxConfig(msConfigData.keys || {});
      if (preferencesData) {
        setPreferences(preferencesData);
        setSelectedFormat(preferencesData.summaryFormat || DEFAULT_SUMMARY_FORMAT);
      }
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

  useEffect(() => {
    void loadSettings();
  }, []);

  const selectedOption = getSummaryFormatOption(selectedFormat);

  if (loading) {
    return (
      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 space-y-5 lg:col-span-8">
          <div className="analyst-glass animate-pulse rounded-2xl p-5">
            <div className="mb-4 h-4 w-32 rounded bg-white/10" />
            <div className="mb-2 h-5 w-64 rounded bg-white/10" />
            <div className="h-3 w-full max-w-md rounded bg-white/5" />
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-32 rounded-lg border border-white/5 bg-white/[0.02]" />
              ))}
            </div>
          </div>
          <div className="analyst-glass animate-pulse rounded-2xl p-5">
            <div className="mb-4 h-4 w-40 rounded bg-white/10" />
            <div className="mb-2 h-5 w-56 rounded bg-white/10" />
            <div className="mt-4 space-y-3 border-t border-white/5 pt-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-10 rounded bg-white/5" />
              ))}
            </div>
          </div>
        </div>
        <div className="col-span-12 space-y-3 lg:col-span-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="analyst-glass animate-pulse rounded-2xl p-5">
              <div className="h-5 w-5 rounded bg-white/10" />
              <div className="mt-3 h-4 w-40 rounded bg-white/10" />
              <div className="mt-2 h-3 w-full rounded bg-white/5" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-12 gap-6 text-[#e7e9ee]">
      <section className="col-span-12 space-y-5 lg:col-span-8">
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
        <TrustCard icon={ShieldCheck} title="Encrypted credentials" body="Shared mailbox credentials are stored encrypted in the Config API. They are never sent to the browser after initial setup." />
        <TrustCard icon={KeyRound} title="App-only auth" body="Newsletter sync uses Microsoft client credentials flow. No individual user sign-in is required." />
        <TrustCard icon={MailCheck} title="Shared mailbox" body="One mailbox serves all team members. Articles are synced automatically and available to everyone." />
      </aside>
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
