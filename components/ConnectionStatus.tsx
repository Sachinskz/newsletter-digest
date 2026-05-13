"use client";

import Link from "next/link";
import { CheckCircle2, Mail, PlugZap, ShieldCheck } from "lucide-react";
import { Chip, GlassPanel } from "@/components/Workspace";

interface Status {
  connected: boolean;
  accountEmail?: string;
  accountName?: string;
  status?: string;
  lastSyncAt?: string;
}

export function ConnectionStatus({ status }: { status: Status | null }) {
  if (!status?.connected) {
    return <ConnectMicrosoftState />;
  }

  return (
    <GlassPanel className="p-5">
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-2xl bg-emerald-400/10 text-emerald-200">
          <Mail className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <Chip tone="good">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Connected
          </Chip>
          <h2 className="mt-3 font-display text-xl font-semibold tracking-[-0.03em] text-white">{status.accountName || "Microsoft 365 connected"}</h2>
          <p className="mt-1 text-sm text-white/55">{status.accountEmail}</p>
          <p className="mt-3 text-xs text-white/38">
            Last sync: {status.lastSyncAt ? new Date(status.lastSyncAt).toLocaleString() : "not synced yet"}
          </p>
        </div>
      </div>
    </GlassPanel>
  );
}

export function ConnectMicrosoftState() {
  return (
    <GlassPanel className="relative overflow-hidden p-6">
      <div className="absolute -right-12 -top-16 h-40 w-40 rounded-full bg-[#7c5cff]/20 blur-3xl" />
      <div className="relative">
        <Chip tone="warn">
          <PlugZap className="h-3.5 w-3.5" />
          OAuth pending
        </Chip>
        <h2 className="mt-5 font-display text-3xl font-semibold tracking-[-0.045em] text-white">
          Connect Microsoft 365 to start syncing newsletters.
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-white/58">
          The production path reads newsletters through Microsoft Graph. Once the portal owner registers the redirect URI
          and provides the secret, this button will connect Outlook and unlock live sync.
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Link href="/api/oauth/authorize" className="workspace-btn bg-[#7c5cff]/22 text-white">
            <Mail className="h-4 w-4" />
            Connect Outlook
          </Link>
          <span className="inline-flex items-center gap-2 text-xs text-white/42">
            <ShieldCheck className="h-4 w-4" />
            Tokens encrypt through Busibox AuthZ keystore
          </span>
        </div>
      </div>
    </GlassPanel>
  );
}
