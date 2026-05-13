import Link from "next/link";
import type { ComponentType } from "react";

interface EmptyStateProps {
  title: string;
  description: string;
  icon?: ComponentType<{ className?: string }>;
  actionHref?: string;
  actionLabel?: string;
}

export function EmptyState({ title, description, icon: Icon, actionHref, actionLabel }: EmptyStateProps) {
  return (
    <div className="rounded-3xl border border-dashed border-white/14 bg-white/[0.035] p-8 text-center">
      {Icon ? <Icon className="mx-auto mb-4 h-7 w-7 text-white/42" /> : null}
      <h2 className="font-display text-xl font-semibold tracking-[-0.03em] text-white">{title}</h2>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-white/54">{description}</p>
      {actionHref && actionLabel ? (
        <Link
          href={actionHref}
          className="workspace-btn mt-5 bg-[#7c5cff]/22 text-white"
        >
          {actionLabel}
        </Link>
      ) : null}
    </div>
  );
}
