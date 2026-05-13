"use client";

import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, Database, Link2, Users } from "lucide-react";
import { deriveLibraryArticles } from "@/lib/editorial-intelligence";
import type { LibraryArticle } from "@/lib/editorial-intelligence";
import type { NewsletterEmail, NewsletterSummary } from "@/lib/types";

export default function ClientsPage() {
  const [articles, setArticles] = useState<LibraryArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    async function loadArticles() {
      setError(null);
      try {
        const [newslettersRes, summariesRes] = await Promise.all([fetch("/api/newsletters"), fetch("/api/summaries")]);
        const newslettersData = await newslettersRes.json();
        const summariesData = await summariesRes.json();
        if (!alive) return;
        setArticles(
          deriveLibraryArticles(
            (newslettersData.newsletters || []) as NewsletterEmail[],
            (summariesData.summaries || []) as NewsletterSummary[],
          ),
        );
      } catch (loadError) {
        if (!alive) return;
        setError(loadError instanceof Error ? loadError.message : "Could not load article context");
        setArticles([]);
      } finally {
        if (alive) setLoading(false);
      }
    }

    void loadArticles();
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="grid grid-cols-12 gap-6 text-[#e7e9ee]">
      <section className="col-span-12 lg:col-span-7">
        <div className="analyst-glass rounded-2xl p-6">
          <div className="mb-2 text-[18px] font-semibold text-white">Client relevance is not wired yet</div>
          <p className="max-w-2xl text-[13px] leading-relaxed text-white/60">
            This page no longer shows seeded client profiles. Right now the app can ingest newsletters, store articles,
            summarize them, and generate content. Persistent client profiles and real relevance matching still need their backend pass.
          </p>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <StatusCard
              icon={CheckCircle2}
              title="Articles available"
              value={loading ? "Loading..." : `${articles.length}`}
              body="Real newsletter-derived articles currently in the app."
              tone="good"
            />
            <StatusCard
              icon={AlertCircle}
              title="Client profiles"
              value="0"
              body="No persisted client records exist yet."
              tone="warn"
            />
            <StatusCard
              icon={AlertCircle}
              title="Auto-matching"
              value="Off"
              body="Matching is blocked until client profile storage is implemented."
              tone="warn"
            />
          </div>

          <div className="mt-6 rounded-xl border border-white/5 bg-white/[0.02] p-4">
            <div className="mb-2 text-[12px] uppercase tracking-wider text-white/45">What already works</div>
            <ul className="space-y-2 text-[12.5px] leading-relaxed text-white/65">
              <li>• Microsoft OAuth can connect a real mailbox and store encrypted tokens.</li>
              <li>• Synced newsletters become real article records in the library.</li>
              <li>• Summaries and generated drafts persist in personal data-api documents.</li>
            </ul>
          </div>

          <div className="mt-4 rounded-xl border border-amber-300/20 bg-amber-300/8 p-4">
            <div className="mb-2 text-[12px] uppercase tracking-wider text-amber-100/80">What is still missing</div>
            <ul className="space-y-2 text-[12.5px] leading-relaxed text-amber-100/75">
              <li>• A real client profile document and CRUD API.</li>
              <li>• Saved matching rules and relevance thresholds per client.</li>
              <li>• Draft routing from matched articles into outreach workflows.</li>
            </ul>
          </div>
        </div>
      </section>

      <aside className="col-span-12 lg:col-span-5">
        <div className="analyst-glass sticky top-6 rounded-2xl p-5">
          <div className="mb-3 text-[13px] font-medium text-white">Backend checklist</div>
          <div className="space-y-3">
            <ChecklistRow icon={Database} label="Client profile document" status="missing" />
            <ChecklistRow icon={Users} label="Client CRUD routes" status="missing" />
            <ChecklistRow icon={Link2} label="Article-to-client match persistence" status="missing" />
          </div>

          <div className="my-4 border-t border-white/5" />

          <div className="mb-2 text-[13px] font-medium text-white">Current state</div>
          <p className="text-[12.5px] leading-relaxed text-white/58">
            The matching algorithm code exists, but the app no longer fabricates demo clients to feed it. This page is now intentionally empty
            until real client records are added through backend storage.
          </p>

          {error ? (
            <div className="mt-4 rounded-xl border border-red-400/25 bg-red-400/10 px-4 py-3 text-[12.5px] text-red-100">
              {error}
            </div>
          ) : null}
        </div>
      </aside>
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
  status: "missing";
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2.5">
      <div className="flex items-center gap-2 text-[12.5px] text-white/72">
        <Icon size={13} className="text-white/45" />
        {label}
      </div>
      <span className="analyst-chip analyst-chip-warn text-[10px]">{status}</span>
    </div>
  );
}
