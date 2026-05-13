"use client";

import { RefreshCw } from "lucide-react";
import { useState } from "react";

interface SyncButtonProps {
  onSynced?: () => void;
}

export function SyncButton({ onSynced }: SyncButtonProps) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function sync() {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/newsletters/sync", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Sync failed");
      setMessage(`${data.inserted} new newsletters from ${data.scanned} messages`);
      onSynced?.();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Sync failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={sync}
        disabled={loading}
        className="workspace-btn h-10 bg-[#7c5cff]/22 text-white disabled:cursor-not-allowed disabled:opacity-60"
      >
        <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        {loading ? "Syncing" : "Sync"}
      </button>
      {message ? <span className="text-sm text-white/55">{message}</span> : null}
    </div>
  );
}
