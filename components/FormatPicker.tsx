"use client";

import { useState } from "react";
import { Check, Newspaper, Sparkles } from "lucide-react";
import { Chip, GlassPanel } from "@/components/Workspace";
import { getSummaryFormatOption, SUMMARY_FORMAT_OPTIONS } from "@/lib/summarization";
import type { NewsletterPreferences, SummaryFormat } from "@/lib/types";

interface FormatPickerProps {
  initialFormat?: SummaryFormat;
  compact?: boolean;
  onSaved?: (preferences: NewsletterPreferences) => void;
}

export function FormatPicker({ initialFormat = "bullet_points", compact = false, onSaved }: FormatPickerProps) {
  const [selected, setSelected] = useState<SummaryFormat>(initialFormat);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const selectedOption = getSummaryFormatOption(selected);

  async function save() {
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ summaryFormat: selected }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save format");
      setMessage("Format preference saved.");
      onSaved?.(data.preferences);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save format");
    } finally {
      setSaving(false);
    }
  }

  return (
    <GlassPanel className={`fade-lift mx-auto ${compact ? "p-5" : "max-w-5xl p-6 sm:p-8"}`}>
      <div className="flex flex-col justify-between gap-4 border-b border-white/10 pb-5 sm:flex-row sm:items-start">
        <div>
          <Chip tone="accent">
            <Sparkles className="h-3.5 w-3.5" />
            First-run setup
          </Chip>
          <h2 className="mt-4 font-display text-3xl font-semibold tracking-[-0.04em] text-white">
            Select a summary format
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/55">
            This controls how Newsletter Digest asks the AI agent to shape every saved briefing.
          </p>
        </div>
        <button type="button" onClick={save} disabled={saving} className="workspace-btn h-10 justify-center bg-[#7c5cff]/20 text-white disabled:cursor-not-allowed disabled:opacity-60">
          {saving ? "Saving..." : "Save format"}
        </button>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {SUMMARY_FORMAT_OPTIONS.map((option) => {
          const active = selected === option.id;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => setSelected(option.id)}
              className={`group relative min-h-48 rounded-3xl border p-5 text-left transition hover:-translate-y-0.5 ${
                active
                  ? "border-[#7c5cff]/80 bg-[#7c5cff]/12 shadow-[0_0_0_3px_rgba(124,92,255,0.18),0_24px_70px_rgba(124,92,255,0.18)]"
                  : "border-white/10 bg-white/[0.035] hover:border-white/18 hover:bg-white/[0.055]"
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="grid h-14 w-14 place-items-center rounded-2xl bg-white/[0.06] text-white/72">
                  <Newspaper className="h-6 w-6" />
                </div>
                {active ? (
                  <span className="grid h-7 w-7 place-items-center rounded-full bg-[#7c5cff] text-white">
                    <Check className="h-4 w-4" />
                  </span>
                ) : null}
              </div>
              <h3 className="mt-8 font-display text-2xl font-semibold tracking-[-0.04em] text-white">{option.title}</h3>
              <p className="mt-2 text-sm leading-6 text-white/52">{option.description}</p>
            </button>
          );
        })}
      </div>

      <div className="mt-6 rounded-3xl border border-white/10 bg-black/20 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-display text-xl font-semibold tracking-[-0.03em] text-white">Preview</h3>
          <Chip tone="cyan">{selectedOption.title}</Chip>
        </div>
        <ul className="mt-4 space-y-3 text-sm leading-6 text-white/68">
          {selectedOption.preview.map((line) => (
            <li key={line} className="flex gap-3">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#2cd0ff]" />
              <span>{line}</span>
            </li>
          ))}
        </ul>
      </div>

      {message ? <p className="mt-4 text-sm text-emerald-200">{message}</p> : null}
      {error ? <p className="mt-4 text-sm text-red-300">{error}</p> : null}
    </GlassPanel>
  );
}
