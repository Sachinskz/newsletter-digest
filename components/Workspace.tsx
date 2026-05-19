"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType, ReactNode } from "react";
import { AppWindow, BookOpenText, BriefcaseBusiness, Clock3, Home, Inbox, LogOut, Mail, PenLine, Settings, Sparkles, UserCircle } from "lucide-react";
import { useSession } from "@jazzmind/busibox-app/components/auth/SessionProvider";
import { Header } from "@jazzmind/busibox-app/layout";

const portalBaseUrl = (process.env.NEXT_PUBLIC_BUSIBOX_PORTAL_URL || process.env.NEXT_PUBLIC_AI_PORTAL_URL || "").replace(/\/+$/, "");
const portalUrl = portalBaseUrl
  ? portalBaseUrl.endsWith("/portal")
    ? portalBaseUrl
    : `${portalBaseUrl}/portal`
  : "/portal";

function BusiboxHeader() {
  const { user, logout } = useSession();
  const session = { user: user ? { ...user as Record<string, unknown>, roles: ((user as Record<string, unknown>)?.roles as string[]) || [] } : null } as import("@jazzmind/busibox-app").SessionData;
  return (
    <Header
      session={session}
      onLogout={logout}
      appsLink={`${portalUrl}/home`}
      accountLink={`${portalUrl}/account`}
    />
  );
}

const navItems = [
  { href: "/", label: "Dashboard", icon: Home },
  { href: "/ingest", label: "Ingest Newsletter", icon: Inbox },
  { href: "/library", label: "Article Library", icon: BookOpenText },
  { href: "/clients", label: "Client Relevance", icon: BriefcaseBusiness },
  { href: "/generate", label: "Content Generator", icon: PenLine },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function WorkspaceLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/" || pathname === "/ingest" || pathname === "/library" || pathname === "/clients" || pathname === "/generate" || pathname === "/settings") {
    return <DashboardWorkspace>{children}</DashboardWorkspace>;
  }

  return (
    <div className="min-h-screen overflow-hidden bg-[#06070b] text-[#e7e9ee]">
      <BusiboxHeader />
      <div className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(700px_500px_at_12%_-10%,rgba(124,92,255,0.18),transparent_60%),radial-gradient(900px_600px_at_95%_10%,rgba(44,208,255,0.10),transparent_60%),radial-gradient(800px_600px_at_60%_110%,rgba(124,92,255,0.10),transparent_60%)]" />
      <div className="relative z-10 flex min-h-screen">
        <AppSidebar />
        <main className="min-w-0 flex-1 lg:pl-72">
          <div className="mx-auto w-full max-w-[1440px] px-4 py-5 sm:px-6 lg:px-8">{children}</div>
        </main>
      </div>
    </div>
  );
}

function DashboardWorkspace({ children }: { children: ReactNode }) {
  return (
    <div
      className="min-h-screen flex flex-col bg-[#06070b] text-[#e7e9ee]"
      style={{ fontFamily: "var(--font-inter), ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}
    >
      <BusiboxHeader />
      <div className="flex flex-1 min-h-0">
        <DashboardSidebar />
        <main className="flex-1 min-w-0">
          <DashboardTopBar />
          <div className="px-8 py-6 max-w-[1400px] mx-auto fade-lift">{children}</div>
        </main>
      </div>
    </div>
  );
}

function AppSidebar() {
  const pathname = usePathname();
  const { user, logout } = useSession();
  const displayName = getUserField(user, "name") || getUserField(user, "email") || "Busibox user";
  const email = getUserField(user, "email");

  async function handleLogout() {
    await logout();
  }

  return (
    <aside className="fixed inset-x-0 top-0 z-30 border-b border-white/10 bg-[#06070b]/88 backdrop-blur-xl lg:inset-y-0 lg:left-0 lg:right-auto lg:w-72 lg:border-b-0 lg:border-r">
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between gap-4 px-4 py-4 lg:block lg:px-5 lg:py-6">
          <Link href="/" className="group flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl border border-[#7c5cff]/40 bg-[#7c5cff]/15 shadow-[0_0_28px_rgba(124,92,255,0.24)]">
              <Mail className="h-5 w-5 text-[#c8b8ff]" />
            </div>
            <div>
              <div className="font-display text-[22px] font-semibold tracking-[-0.04em] text-white">Newsletter Digest</div>
              <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-white/38">AI briefing desk</div>
            </div>
          </Link>
          <Link
            href={`${portalUrl}/home`}
            className="inline-flex h-9 items-center gap-2 rounded-xl border border-white/10 px-3 text-xs font-medium text-white/60 transition hover:border-white/20 hover:bg-white/5 hover:text-white lg:hidden"
          >
            <AppWindow className="h-4 w-4" />
            Apps
          </Link>
        </div>

        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-col lg:overflow-visible lg:px-3 lg:pb-0">
          {navItems.map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link key={item.href} href={item.href} className={`nav-rail-item ${active ? "active" : ""}`}>
                <item.icon className="h-4 w-4 shrink-0" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto hidden space-y-3 p-4 lg:block">
          <GlassPanel className="p-4">
            <div className="flex items-start gap-3">
              <UserCircle className="mt-0.5 h-5 w-5 text-white/50" />
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-white">{displayName}</div>
                {email ? <div className="truncate text-xs text-white/40">{email}</div> : null}
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Link href={`${portalUrl}/home`} className="workspace-btn justify-center">
                Apps
              </Link>
              <button type="button" onClick={handleLogout} className="workspace-btn justify-center">
                <LogOut className="h-3.5 w-3.5" />
                Sign out
              </button>
            </div>
          </GlassPanel>
        </div>
      </div>
    </aside>
  );
}

function DashboardSidebar() {
  const pathname = usePathname();
  const { user, logout } = useSession();
  const displayName = getUserField(user, "name") || getUserField(user, "email") || "Busibox user";
  const roleLabel = "AI operator";

  async function handleLogout() {
    await logout();
  }

  return (
    <aside className="w-64 shrink-0 border-r border-white/5 bg-black/20 backdrop-blur-md min-h-screen flex flex-col">
      <div className="px-5 pt-6 pb-5">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-violet-500/30">
            <Sparkles size={18} className="text-white" />
          </div>
          <div className="leading-tight">
            <div className="text-[15px] font-semibold tracking-tight text-white">AI Newsletter</div>
            <div className="text-[11px] text-white/40">your AI analyst</div>
          </div>
        </div>
      </div>
      <nav className="px-3 flex flex-col gap-1">
        {navItems.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-[10px] px-3 py-[9px] rounded-[10px] text-[13.5px] font-medium transition ${
                active
                  ? "text-white bg-[linear-gradient(180deg,rgba(124,92,255,0.18),rgba(124,92,255,0.06))] border border-[rgba(124,92,255,0.25)]"
                  : "text-white/50 hover:text-white hover:bg-white/[0.04]"
              }`}
            >
              <item.icon size={16} className={active ? "text-[#c8b8ff]" : ""} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto p-3">
        <div className="rounded-xl border border-white/10 bg-white/[0.04] backdrop-blur-[14px] p-3 mb-3">
          <div className="text-[11px] uppercase tracking-wider text-white/40 mb-2">Live</div>
          <div className="flex items-center gap-2 text-[12px]">
            <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_0_0_rgba(52,211,153,0.6)] animate-pulse" />
            <span className="text-white/70">Brief refreshes every 6h</span>
          </div>
        </div>
        <div className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-white/5">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500/40 to-cyan-400/40 flex items-center justify-center text-sm font-medium text-white">
            {displayName[0]}
          </div>
          <div className="leading-tight flex-1 min-w-0">
            <div className="text-[13px] font-medium truncate text-white">{displayName}</div>
            <div className="text-[11px] text-white/40 truncate">{roleLabel}</div>
          </div>
          <button type="button" onClick={handleLogout} className="text-white/40 hover:text-white transition">
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </aside>
  );
}

function DashboardTopBar() {
  const pathname = usePathname();
  const meta =
    pathname === "/ingest"
      ? { title: "Ingest a Newsletter", subtitle: "Paste or route newsletters here and extract what matters." }
      : pathname === "/library"
        ? { title: "Article Library", subtitle: "Search, rank, and review the stories shaping your AI brief." }
        : pathname === "/clients"
          ? { title: "Client Relevance", subtitle: "Match live AI stories to clients, sectors, and current priorities." }
          : pathname === "/generate"
            ? { title: "Content Generator", subtitle: "Turn selected stories into client-ready drafts and operator-facing content." }
            : pathname === "/settings"
              ? { title: "Settings", subtitle: "Manage Microsoft access, summary format, and generation behavior." }
              : { title: "Dashboard", subtitle: "What you need to know about AI today." };
  return (
    <div className="border-b border-[#ea580c]/18 bg-[linear-gradient(180deg,rgba(234,88,12,0.16),rgba(234,88,12,0.05)_58%,rgba(6,7,11,0.02))] px-8 pt-7 pb-5 shadow-[inset_0_-1px_0_rgba(255,255,255,0.02)]">
      <div className="max-w-[1400px] mx-auto flex items-center justify-between gap-6">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-[#fb923c]/25 bg-[#fb923c]/10 px-[10px] py-[3px] text-[10.5px] font-semibold uppercase tracking-[0.18em] text-[#fed7aa]">
            Briefing workspace
          </div>
          <h1 className="mt-3 text-[22px] font-semibold tracking-tight text-white">{meta.title}</h1>
          <p className="mt-0.5 text-[13px] text-white/58">{meta.subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden md:flex items-center gap-2 rounded-full border border-[#fdba74]/18 bg-[#fdba74]/8 px-[10px] py-[3px] text-[11px] font-medium text-[#fed7aa]">
            <Clock3 size={12} />
            Updated recently
          </div>
          <div className="inline-flex items-center gap-[6px] rounded-full border border-emerald-400/30 bg-emerald-400/10 px-[10px] py-[3px] text-[11px] font-medium text-emerald-200">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-300 animate-pulse" />
            All sources synced
          </div>
        </div>
      </div>
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col justify-between gap-5 border-b border-white/10 pb-6 pt-24 lg:flex-row lg:items-end lg:pt-2">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/42">{eyebrow}</p>
        <h1 className="mt-3 max-w-4xl font-display text-4xl font-semibold tracking-[-0.055em] text-white sm:text-5xl">
          {title}
        </h1>
        {description ? <p className="mt-3 max-w-2xl text-sm leading-6 text-white/56">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function GlassPanel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-3xl border border-white/10 bg-white/[0.045] shadow-[0_24px_80px_rgba(0,0,0,0.28)] backdrop-blur-xl ${className}`}>
      {children}
    </div>
  );
}

export function Chip({
  children,
  tone = "neutral",
  className = "",
}: {
  children: ReactNode;
  tone?: "neutral" | "accent" | "cyan" | "good" | "warn";
  className?: string;
}) {
  const tones = {
    neutral: "border-white/10 bg-white/[0.045] text-white/52",
    accent: "border-[#7c5cff]/35 bg-[#7c5cff]/12 text-[#cdbcff]",
    cyan: "border-[#2cd0ff]/30 bg-[#2cd0ff]/10 text-[#b1e9ff]",
    good: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
    warn: "border-amber-300/30 bg-amber-300/10 text-amber-100",
  };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${tones[tone]} ${className}`}>
      {children}
    </span>
  );
}

function getUserField(user: unknown, key: "name" | "email"): string | undefined {
  if (!user || typeof user !== "object") return undefined;
  const value = (user as Record<string, unknown>)[key];
  return typeof value === "string" ? value : undefined;
}
