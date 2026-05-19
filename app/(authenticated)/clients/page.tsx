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
  Sparkles,
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

type ClientRelevanceBackend = {
  clientProfileDocument: "ready";
  clientCrudRoutes: "ready";
  matchPersistence: "ready";
  refreshMode: "on_read";
};

type ClientRelevanceStats = {
  articleCount: number;
  clientCount: number;
  matchCount: number;
  matchedClientCount: number;
  unmatchedClientCount: number;
};

export default function ClientsPage() {
  const [clients, setClients] = useState<NewsletterClientProfile[]>([]);
  const [matches, setMatches] = useState<NewsletterClientMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [enrichSource, setEnrichSource] = useState("");
  const [enriching, setEnriching] = useState(false);
  const [enrichError, setEnrichError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [form, setForm] = useState<ClientFormState>(EMPTY_FORM);
  const [stats, setStats] = useState<ClientRelevanceStats>({
    articleCount: 0,
    clientCount: 0,
    matchCount: 0,
    matchedClientCount: 0,
    unmatchedClientCount: 0,
  });
  const [backend, setBackend] = useState<ClientRelevanceBackend>({
    clientProfileDocument: "ready",
    clientCrudRoutes: "ready",
    matchPersistence: "ready",
    refreshMode: "on_read",
  });
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string | null>(null);

  async function loadWorkspace(options?: { preserveLoading?: boolean }) {
    setError(null);
    if (!options?.preserveLoading) setRefreshing(true);
    try {
      const res = await fetch("/api/client-relevance");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Could not load client relevance workspace");
      }

      const nextClients = (data.clients || []) as NewsletterClientProfile[];
      setClients(nextClients);
      setMatches((data.matches || []) as NewsletterClientMatch[]);
      setStats({
        articleCount: typeof data.stats?.articleCount === "number" ? data.stats.articleCount : 0,
        clientCount: typeof data.stats?.clientCount === "number" ? data.stats.clientCount : nextClients.length,
        matchCount: typeof data.stats?.matchCount === "number" ? data.stats.matchCount : (data.matches || []).length,
        matchedClientCount: typeof data.stats?.matchedClientCount === "number" ? data.stats.matchedClientCount : 0,
        unmatchedClientCount: typeof data.stats?.unmatchedClientCount === "number" ? data.stats.unmatchedClientCount : 0,
      });
      if (data.backend) {
        setBackend(data.backend as ClientRelevanceBackend);
      }
      setLastRefreshedAt(typeof data.lastRefreshedAt === "string" ? data.lastRefreshedAt : null);
      setSelectedClientId((current) => {
        if (current && nextClients.some((client) => client.id === current)) return current;
        return nextClients[0]?.id || null;
      });
    } finally {
      if (!options?.preserveLoading) setRefreshing(false);
    }
  }

  useEffect(() => {
    let alive = true;

    async function hydrate() {
      try {
        await loadWorkspace({ preserveLoading: true });
      } catch (loadError) {
        if (!alive) return;
        setError(loadError instanceof Error ? loadError.message : "Could not load client relevance workspace");
        setClients([]);
        setMatches([]);
        setStats({
          articleCount: 0,
          clientCount: 0,
          matchCount: 0,
          matchedClientCount: 0,
          unmatchedClientCount: 0,
        });
      } finally {
        if (alive) {
          setLoading(false);
          setRefreshing(false);
        }
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

  const matchCountByClient = useMemo(() => {
    return matches.reduce<Record<string, number>>((accumulator, match) => {
      accumulator[match.clientId] = (accumulator[match.clientId] || 0) + 1;
      return accumulator;
    }, {});
  }, [matches]);

  function resetForm() {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setFormError(null);
  }

  async function enrichClient() {
    if (!enrichSource.trim()) return;
    setEnriching(true);
    setEnrichError(null);
    try {
      const res = await fetch("/api/clients/enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: enrichSource.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not enrich client profile");

      const client = data.client as {
        name: string;
        sector: string;
        topics: string[];
        priorities: string;
        accountOwner?: string;
        relationshipStage: string;
        matchThreshold: number;
        notes: string;
      };
      setForm((current) => ({
        ...current,
        name: client.name || current.name,
        sector: client.sector || current.sector,
        topics: client.topics?.join(", ") || current.topics,
        priorities: client.priorities || current.priorities,
        accountOwner: client.accountOwner || current.accountOwner,
        relationshipStage: client.relationshipStage || current.relationshipStage,
        matchThreshold: String(client.matchThreshold ?? current.matchThreshold),
        notes: client.notes || current.notes,
      }));
      setEnrichSource("");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not enrich client profile";
      setEnrichError(msg);
    } finally {
      setEnriching(false);
    }
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
      await loadWorkspace({ preserveLoading: true });
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

      await loadWorkspace({ preserveLoading: true });
      if (editingId === id) resetForm();
    } catch (deleteError) {
      setFormError(deleteError instanceof Error ? deleteError.message : "Could not delete client");
    }
  }

  if (loading) {
    return (
      <div className="grid grid-cols-12 gap-6 text-[#e7e9ee]">
        <section className="col-span-12 space-y-6 lg:col-span-7">
          <ClientsSkeletonPanel>
            <div className="h-5 w-56 rounded bg-white/[0.06]" />
            <div className="h-3 w-full rounded bg-white/[0.04]" />
            <div className="grid grid-cols-3 gap-3 pt-2">
              <div className="h-20 rounded-lg bg-white/[0.04]" />
              <div className="h-20 rounded-lg bg-white/[0.04]" />
              <div className="h-20 rounded-lg bg-white/[0.04]" />
            </div>
          </ClientsSkeletonPanel>
          <ClientsSkeletonPanel>
            <div className="h-4 w-32 rounded bg-white/[0.06]" />
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="flex items-center gap-3 rounded-lg border border-white/5 bg-white/[0.02] p-3">
                <div className="h-8 w-8 rounded-md bg-white/[0.06]" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-40 rounded bg-white/[0.06]" />
                  <div className="h-3 w-24 rounded bg-white/[0.04]" />
                </div>
              </div>
            ))}
          </ClientsSkeletonPanel>
        </section>
        <aside className="col-span-12 space-y-6 lg:col-span-5">
          <ClientsSkeletonPanel>
            <div className="h-5 w-36 rounded bg-white/[0.06]" />
            <div className="h-10 w-full rounded bg-white/[0.04]" />
            <div className="h-10 w-full rounded bg-white/[0.04]" />
            <div className="h-10 w-full rounded bg-white/[0.04]" />
            <div className="h-10 w-full rounded bg-white/[0.04]" />
          </ClientsSkeletonPanel>
        </aside>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-12 gap-6 text-[#e7e9ee]">
      <section className="col-span-12 space-y-6 lg:col-span-7">
        <div className="analyst-glass rounded-2xl p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="mb-2 text-[18px] font-semibold text-white">Client relevance is live</div>
              <p className="max-w-2xl text-[13px] leading-relaxed text-white/60">
                Client profiles and article matches now persist in data-api. This page reads stored relevance records from the backend and separates
                infrastructure readiness from workspace population, so an empty account no longer looks like a missing feature.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button className="analyst-btn" type="button" onClick={() => void loadWorkspace()} disabled={refreshing}>
                {refreshing ? <LoaderCircle size={13} className="animate-spin" /> : <Link2 size={13} />}
                {refreshing ? "Refreshing..." : "Refresh matches"}
              </button>
              <button className="analyst-btn" type="button" onClick={resetForm}>
                <Plus size={13} />
                New client
              </button>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <StatusCard
              icon={CheckCircle2}
              title="Articles available"
              value={loading ? "Loading..." : `${stats.articleCount}`}
              body="Real newsletter-derived articles currently indexed for relevance."
              tone={stats.articleCount > 0 ? "good" : "warn"}
            />
            <StatusCard
              icon={Users}
              title="Client profiles"
              value={loading ? "Loading..." : `${stats.clientCount}`}
              body="Persisted client records stored in the backend."
              tone={stats.clientCount > 0 ? "good" : "warn"}
            />
            <StatusCard
              icon={Link2}
              title="Stored matches"
              value={loading ? "Loading..." : `${stats.matchCount}`}
              body="Persisted client/article scoring records ready for reuse across the app."
              tone={stats.matchCount > 0 ? "good" : "warn"}
            />
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2 text-[11.5px] text-white/48">
            <span className="analyst-chip analyst-chip-good">Backend ready</span>
            <span>Refresh mode: on-read recompute + persistence</span>
            {lastRefreshedAt ? <span>Last refreshed {formatReceivedAt(lastRefreshedAt)}</span> : null}
          </div>
        </div>

        <div className="analyst-glass rounded-2xl p-6">
          <div className="mb-4 flex items-center gap-2">
            <BriefcaseBusiness size={15} className="text-white/70" />
            <div className="text-[14px] font-medium text-white">{editingId ? "Edit client profile" : "Add client profile"}</div>
          </div>

          <div className="mb-4 rounded-xl border border-white/8 bg-white/[0.03] p-3">
            <div className="mb-2 flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-white/45">
              <Sparkles size={11} />
              Auto-fill the full client profile
            </div>
            <div className="flex gap-2">
              <input
                className="analyst-input flex-1"
                value={enrichSource}
                onChange={(event) => setEnrichSource(event.target.value)}
                onKeyDown={(event) => { if (event.key === "Enter") void enrichClient(); }}
                placeholder="e.g. Goldman Sachs, OpenAI, or https://acme.com"
                disabled={enriching}
              />
              <button
                type="button"
                className="analyst-btn analyst-btn-primary shrink-0"
                onClick={() => void enrichClient()}
                disabled={enriching || !enrichSource.trim()}
              >
                {enriching ? <LoaderCircle size={13} className="animate-spin" /> : <Sparkles size={13} />}
                {enriching ? "Populating..." : "Populate"}
              </button>
            </div>
            {enrichError ? (
              <div className="mt-2 text-[11.5px] text-red-300">{enrichError}</div>
            ) : null}
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
                        <div className="mt-2 text-[11px] text-white/42">
                          {matchCountByClient[client.id] || 0} stored matches · threshold {client.matchThreshold ?? 42}+
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
            <ChecklistRow icon={Database} label="Client profile document" status={backend.clientProfileDocument} />
            <ChecklistRow icon={Users} label="Client CRUD routes" status={backend.clientCrudRoutes} />
            <ChecklistRow icon={Link2} label="Article-to-client match persistence" status={backend.matchPersistence} />
          </div>

          <div className="my-4 border-t border-white/5" />

          <div className="mb-2 text-[13px] font-medium text-white">Workspace state</div>
          <div className="grid gap-2 sm:grid-cols-2">
            <MiniMetric label="Matched clients" value={String(stats.matchedClientCount)} />
            <MiniMetric label="Waiting on matches" value={String(stats.unmatchedClientCount)} />
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
                    No stored articles currently clear this client&apos;s threshold. The backend is healthy; this just means the current article set does not
                    overlap enough yet. Lower the threshold or broaden topics if you want wider coverage.
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

function ClientsSkeletonPanel({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] p-6">
      <div className="animate-pulse space-y-4">{children}</div>
    </div>
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

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2.5">
      <div className="text-[10px] uppercase tracking-wider text-white/38">{label}</div>
      <div className="mt-1 text-[15px] font-semibold text-white">{value}</div>
    </div>
  );
}
