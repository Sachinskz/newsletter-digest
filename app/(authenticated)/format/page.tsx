"use client";

import { useEffect, useState } from "react";
import { FormatPicker } from "@/components/FormatPicker";
import { Chip, GlassPanel, PageHeader } from "@/components/Workspace";
import { DEFAULT_SUMMARY_FORMAT, getSummaryFormatOption } from "@/lib/summarization";
import type { NewsletterPreferences, SummaryFormat } from "@/lib/types";

interface PreferencesResponse {
  preferences: NewsletterPreferences | null;
  hasPreferences: boolean;
  summaryFormat: SummaryFormat;
}

export default function FormatPage() {
  const [preferences, setPreferences] = useState<PreferencesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadPreferences() {
    setError(null);
    try {
      const res = await fetch("/api/preferences");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not load preferences");
      setPreferences(data);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load preferences");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadPreferences();
  }, []);

  const summaryFormat = preferences?.summaryFormat || DEFAULT_SUMMARY_FORMAT;
  const option = getSummaryFormatOption(summaryFormat);

  return (
    <div className="fade-lift">
      <PageHeader
        eyebrow="Format Choices"
        title="Tune the shape of every AI brief."
        description="Change the preferred summary format at any time. New summaries will use the saved choice."
      />

      {error ? <div className="mt-6 rounded-2xl border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-100">{error}</div> : null}

      <div className="mt-8 grid gap-6 xl:grid-cols-[1fr_340px]">
        {loading ? (
          <GlassPanel className="p-8 text-sm text-white/55">Loading format choices...</GlassPanel>
        ) : (
          <FormatPicker
            initialFormat={summaryFormat}
            onSaved={(saved) => setPreferences({ preferences: saved, hasPreferences: true, summaryFormat: saved.summaryFormat })}
          />
        )}

        <GlassPanel className="p-5">
          <Chip tone="accent">Current preference</Chip>
          <h2 className="mt-4 font-display text-2xl font-semibold tracking-[-0.04em] text-white">{option.title}</h2>
          <p className="mt-2 text-sm leading-6 text-white/56">{option.description}</p>
          <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/38">Agent behavior</p>
            <p className="mt-2 text-sm leading-6 text-white/62">
              This preference is injected into the summarization prompt before `agent-api` runs. Existing summaries keep
              their original format.
            </p>
          </div>
        </GlassPanel>
      </div>
    </div>
  );
}
