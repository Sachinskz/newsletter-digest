"use client";

import Link from "next/link";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import {
  BriefcaseBusiness,
  CheckCircle2,
  Database,
  Link2,
  LoaderCircle,
  Pencil,
  Plus,
  Trash2,
  Users,
} from "lucide-react";
import { categoryTone, formatReceivedAt } from "@/lib/editorial-intelligence";
import type { NewsletterClientMatch, NewsletterClientProfile } from "@/lib/types";

type ClientFormState = {
  name: string;
  sector: string;
  topics: string;
  priorities: string;
  accountOwner: string;
  relationshipStage: string;
  notes: string;
  matchThreshold: string;
};

const EMPTY_FORM: ClientFormState = {
  name: "",
  sector: "",
  topics: "",
  priorities: "",
  accountOwner: "",
  relationshipStage: "",
  notes: "",
  matchThreshold: "42",
};

export default function ClientsPage() {
  const [articleCount, setArticleCount] = useState(0);
  const [clients, setClients] = useState<NewsletterClientProfile[]>([]);
  const [matches, setMatches] = useState<NewsletterClientMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [form, setForm] = useState<ClientFormState>(EMPTY_FORM);

  async function loadWorkspace() {
    setError(null);
    const res = await fetch("/api/client-relevance");
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || "Could not load client relevance workspace");
    }

    const nextClients = (data.clients || []) as NewsletterClientProfile[];
    setClients(nextClients);
    setMatches((data.matches || []) as NewsletterClientMatch[]);
    setArticleCount(typeof data.articleCount === "number" ? data.articleCount : 0);
    setSelectedClientId((current) => {
      if (current && nextClients.some((client) => client.id === current)) return current;
      return nextClients[0]?.id || null;
    });
  }

  useEffect(() => {
    let alive = true;

    async function hydrate() {
      try {
        await loadWorkspace();
      } catch (loadError) {
        if (!alive) return;
        setError(loadError instanceof Error ? loadError.message : "Could not load client relevance workspace");
        setClients([]);
        setMatches([]);
        setArticleCount(0);
      } finally {
        if (alive) setLoading(false);
      }
    }

    void hydrate();
    return () => {
      alive = false;
    };
  }, []);

  const selectedClient = useMemo(
    () => clients.find((client) => client.id === selectedClientId) || clients[0] || null,
    [clients, selectedClientId],
  );

  const topMatches = useMemo(() => {
    if (!selectedClient) return [];
    return matches.filter((match) => match.clientId === selectedClient.id).slice(0, 8);
  }, [matches, selectedClient]);

  function resetForm() {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setFormError(null);
  }

  function startEditing(client: NewsletterClientProfile) {
    setEditingId(client.id);
    setSelectedClientId(client.id);
    setForm({
      name: client.name,
      sector: client.sector,
      topics: client.topics.join(", "),
      priorities: client.priorities,
      accountOwner: client.accountOwner || "",
      relationshipStage: client.relationshipStage || "",
      notes: client.notes || "",
      matchThreshold: String(client.matchThreshold ?? 42),
    });
    setFormError(null);
  }

  async function saveClient() {
    setFormError(null);
    const topics = form.topics
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

    if (!form.name.trim() || !form.sector.trim() || !form.priorities.trim() || topics.length === 0) {
      setFormError("Name, sector, priorities, and at least one topic are required.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        sector: form.sector.trim(),
        topics,
        priorities: form.priorities.trim(),
        accountOwner: form.accountOwner.trim(),
        relationshipStage: form.relationshipStage.trim(),
        notes: form.notes.trim(),
        matchThreshold: form.matchThreshold.trim(),
      };
      const res = await fetch(editingId ? `/api/clients/${editingId}` : "/api/clients", {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Could not save client");
      }

      const savedClient = data.client as NewsletterClientProfile;
      await loadWorkspace();
      setSelectedClientId(savedClient.id);
      resetForm();
    } catch (saveError) {
      setFormError(saveError instanceof Error ? saveError.message : "Could not save client");
    } finally {
      setSaving(false);
    }
  }

  async function removeClient(id: string) {
    const confirmed = window.confirm("Delete this client profile?");
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/clients/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not delete client");

      await loadWorkspace();
      if (editingId === id) resetForm();
    } catch (deleteError) {
      setFormError(deleteError instanceof Error ? deleteError.message : "Could not delete client");
    }
  }

  const checklistStatus: {
    profile: "ready" | "missing";
    crud: "ready";
    matching: "ready" | "missing";
  } = {
    profile: clients.length > 0 ? "ready" : "missing",
    crud: "ready" as const,
    matching: clients.length > 0 && articleCount > 0 ? "ready" : "missing",
  };

  return (
    <div className="grid grid-cols-12 gap-6 text-[#e7e9ee]">
      <section className="col-span-12 space-y-6 lg:col-span-7">
        <div className="analyst-glass rounded-2xl p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="mb-2 text-[18px] font-semibold text-white">Client relevance is started</div>
              <p className="max-w-2xl text-[13px] leading-relaxed text-white/60">
                Client profiles and article matches now persist in data-api. This page is reading stored relevance records instead of calculating everything
                in the browser, so the backend path is now live.
              </p>
            </div>
            <button className="analyst-btn" type="button" onClick={resetForm}>
              <Plus size={13} />
              New client
            </button>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <StatusCard
              icon={CheckCircle2}
              title="Articles available"
              value={loading ? "Loading..." : `${articleCount}`}
              body="Real newsletter-derived articles currently in the app."
              tone="good"
            />
            <StatusCard
              icon={Users}
              title="Client profiles"
              value={loading ? "Loading..." : `${clients.length}`}
              body="Persisted client records stored in the app backend."
              tone={clients.length > 0 ? "good" : "warn"}
            />
            <StatusCard
              icon={Link2}
              title="Matching status"
              value={clients.length > 0 && articleCount > 0 ? "Persisted" : "Waiting"}
              body="Deterministic client/article scoring is refreshed on the backend and stored for reuse."
              tone={clients.length > 0 && articleCount > 0 ? "good" : "warn"}
            />
          </div>
        </div>

        <div className="analyst-glass rounded-2xl p-6">
          <div className="mb-4 flex items-center gap-2">
            <BriefcaseBusiness size={15} className="text-white/70" />
            <div className="text-[14px] font-medium text-white">{editingId ? "Edit client profile" : "Add client profile"}</div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Client name">
              <input
                className="analyst-input"
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                placeholder="Harbor Capital"
              />
            </Field>
            <Field label="Sector">
              <input
                className="analyst-input"
                value={form.sector}
                onChange={(event) => setForm((current) => ({ ...current, sector: event.target.value }))}
                placeholder="Financial services"
              />
            </Field>
            <Field label="Topics">
              <input
                className="analyst-input"
                value={form.topics}
                onChange={(event) => setForm((current) => ({ ...current, topics: event.target.value }))}
                placeholder="agents, compliance, workflow automation"
              />
            </Field>
            <Field label="Match threshold">
              <input
                className="analyst-input"
                type="number"
                min={0}
                max={100}
                value={form.matchThreshold}
                onChange={(event) => setForm((current) => ({ ...current, matchThreshold: event.target.value }))}
                placeholder="42"
              />
            </Field>
            <Field label="Account owner">
              <input
                className="analyst-input"
                value={form.accountOwner}
                onChange={(event) => setForm((current) => ({ ...current, accountOwner: event.target.value }))}
                placeholder="Avery Chen"
              />
            </Field>
            <Field label="Relationship stage">
              <input
                className="analyst-input"
                value={form.relationshipStage}
                onChange={(event) => setForm((current) => ({ ...current, relationshipStage: event.target.value }))}
                placeholder="Active pursuit"
              />
            </Field>
            <Field label="Priorities" className="sm:col-span-2">
              <textarea
                className="analyst-input min-h-[92px]"
                value={form.priorities}
                onChange={(event) => setForm((current) => ({ ...current, priorities: event.target.value }))}
                placeholder="Modernize internal workflows, tighten governance, and improve on-prem deployment posture."
              />
            </Field>
            <Field label="Notes" className="sm:col-span-2">
              <textarea
                className="analyst-input min-h-[88px]"
                value={form.notes}
                onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                placeholder="Optional account context, recent meetings, current trigger events..."
              />
            </Field>
          </div>

          {formError ? (
            <div className="mt-4 rounded-xl border border-red-400/25 bg-red-400/10 px-4 py-3 text-[12.5px] text-red-100">{formError}</div>
          ) : null}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button className="analyst-btn analyst-btn-primary" type="button" onClick={saveClient} disabled={saving}>
              {saving ? <LoaderCircle size={13} className="animate-spin" /> : <Database size={13} />}
              {saving ? "Saving..." : editingId ? "Save changes" : "Create client"}
            </button>
            {editingId ? (
              <button className="analyst-btn" type="button" onClick={resetForm} disabled={saving}>
                Cancel edit
              </button>
            ) : null}
          </div>
        </div>

        <div className="analyst-glass rounded-2xl p-6">
          <div className="mb-3 text-[14px] font-medium text-white">Saved client profiles</div>
          {clients.length === 0 ? (
            <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4 text-[12.5px] leading-relaxed text-white/55">
              No client profiles yet. Add one above to start previewing relevance matches against your stored articles.
            </div>
          ) : (
            <div className="space-y-3">
              {clients.map((client) => {
                const active = client.id === selectedClient?.id;
                return (
                  <div
                    key={client.id}
                    className={`rounded-xl border p-4 transition ${
                      active ? "border-violet-400/30 bg-violet-500/[0.08]" : "border-white/5 bg-white/[0.02]"
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setSelectedClientId(client.id)}>
                        <div className="text-[14px] font-medium text-white">{client.name}</div>
                        <div className="mt-1 text-[12px] text-white/55">
                          {client.sector}
                          {client.accountOwner ? ` · ${client.accountOwner}` : ""}
                          {client.relationshipStage ? ` · ${client.relationshipStage}` : ""}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {client.topics.map((topic) => (
                            <span key={topic} className="analyst-chip text-[10px]">
                              {topic}
                            </span>
                          ))}
                        </div>
                      </button>
                      <div className="flex items-center gap-2">
                        <button className="analyst-btn analyst-btn-ghost px-2 py-1.5" type="button" onClick={() => startEditing(client)}>
                          <Pencil size={13} />
                        </button>
                        <button className="analyst-btn analyst-btn-ghost px-2 py-1.5" type="button" onClick={() => void removeClient(client.id)}>
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                    <div className="mt-3 text-[12px] leading-relaxed text-white/62">{client.priorities}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <aside className="col-span-12 space-y-6 lg:col-span-5">
        <div className="analyst-glass sticky top-6 rounded-2xl p-5">
          <div className="mb-3 text-[13px] font-medium text-white">Backend checklist</div>
          <div className="space-y-3">
            <ChecklistRow icon={Database} label="Client profile document" status={checklistStatus.profile} />
            <ChecklistRow icon={Users} label="Client CRUD routes" status={checklistStatus.crud} />
            <ChecklistRow icon={Link2} label="Article-to-client match persistence" status={checklistStatus.matching} />
          </div>

          <div className="my-4 border-t border-white/5" />

          <div className="mb-2 text-[13px] font-medium text-white">Match preview</div>
          {selectedClient ? (
            <>
              <p className="text-[12.5px] leading-relaxed text-white/58">
                Showing the strongest stored article matches for <span className="text-white">{selectedClient.name}</span>. Threshold:{" "}
                {selectedClient.matchThreshold ?? 42}+.
              </p>

              <div className="mt-4 space-y-3">
                {topMatches.length > 0 ? (
                  topMatches.map((match) => (
                    <div key={`${match.clientId}-${match.articleId}`} className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
                      <div className="mb-2 flex items-start justify-between gap-3">
                        <span className={`analyst-chip ${categoryTone(match.articleCategory)} text-[10px]`}>{match.articleCategory}</span>
                        <span className="analyst-chip analyst-chip-accent text-[10px]">Score {match.score}</span>
                      </div>
                      <div className="text-[13px] font-medium leading-snug text-white">{match.articleTitle}</div>
                      <div className="mt-1 text-[11px] text-white/45">
                        {match.articleSource} · {formatReceivedAt(match.articleReceivedAt)}
                      </div>
                      <p className="mt-2 text-[12px] leading-relaxed text-white/62">{match.reason}</p>
                      <div className="mt-3 flex items-center gap-2">
                        <Link className="analyst-btn py-1.5 text-[11.5px]" href={`/library?article=${encodeURIComponent(match.articleId)}`}>
                          Open article
                        </Link>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-xl border border-amber-300/20 bg-amber-300/8 p-4 text-[12.5px] leading-relaxed text-amber-100/75">
                    No stored articles currently clear this client&apos;s threshold. Lower the threshold or add more specific topics if you want broader matches.
                  </div>
                )}
              </div>
            </>
          ) : (
            <p className="text-[12.5px] leading-relaxed text-white/58">
              Add a client profile to start previewing article relevance from the newsletters already stored in the app.
            </p>
          )}

          {error ? (
            <div className="mt-4 rounded-xl border border-red-400/25 bg-red-400/10 px-4 py-3 text-[12.5px] text-red-100">{error}</div>
          ) : null}
        </div>
      </aside>
    </div>
  );
}

function Field({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={className}>
      <div className="mb-1.5 text-[11px] uppercase tracking-wider text-white/45">{label}</div>
      {children}
    </label>
  );
}

function StatusCard({
  icon: Icon,
  title,
  value,
  body,
  tone,
}: {
  icon: typeof CheckCircle2;
  title: string;
  value: string;
  body: string;
  tone: "good" | "warn";
}) {
  const toneClass =
    tone === "good"
      ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-100"
      : "border-amber-300/20 bg-amber-300/10 text-amber-100";

  return (
    <div className={`rounded-xl border p-4 ${toneClass}`}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <Icon size={16} />
        <div className="text-[18px] font-semibold leading-none">{value}</div>
      </div>
      <div className="text-[12.5px] font-medium">{title}</div>
      <div className="mt-1 text-[11.5px] leading-relaxed opacity-80">{body}</div>
    </div>
  );
}

function ChecklistRow({
  icon: Icon,
  label,
  status,
}: {
  icon: typeof Database;
  label: string;
  status: "ready" | "preview" | "missing";
}) {
  const chipClass =
    status === "ready"
      ? "analyst-chip-good"
      : status === "preview"
        ? "analyst-chip-accent"
        : "analyst-chip-warn";

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2.5">
      <div className="flex items-center gap-2 text-[12.5px] text-white/72">
        <Icon size={13} className="text-white/45" />
        {label}
      </div>
      <span className={`analyst-chip ${chipClass} text-[10px]`}>{status}</span>
    </div>
  );
}
