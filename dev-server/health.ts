import { DevServerConfig, getServiceUrl, isTokenExpired, tokenTimeRemaining } from "./config";

interface ServiceCheck {
  name: string;
  url: string;
  ok: boolean;
  error?: string;
}

interface HealthReport {
  services: ServiceCheck[];
  token: { valid: boolean; remaining: string };
  allHealthy: boolean;
}

async function checkService(name: string, baseUrl: string, path: string): Promise<ServiceCheck> {
  const url = `${baseUrl}${path}`;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    clearTimeout(timeout);

    return { name, url: baseUrl, ok: res.ok };
  } catch (err) {
    const message =
      err instanceof Error
        ? err.name === "AbortError"
          ? "timeout (5s)"
          : err.message
        : String(err);
    return { name, url: baseUrl, ok: false, error: message };
  }
}

export async function runHealthChecks(config: DevServerConfig): Promise<HealthReport> {
  const checks: Array<{ name: string; service: Parameters<typeof getServiceUrl>[1]; healthPath: string }> = [
    { name: "AuthZ", service: "authzPort", healthPath: "/health/ready" },
    { name: "Data API", service: "dataApiPort", healthPath: "/health" },
    { name: "Agent API", service: "agentApiPort", healthPath: "/health" },
    { name: "Search API", service: "searchApiPort", healthPath: "/health" },
    { name: "Portal", service: "portalPort", healthPath: "/portal/api/health" },
  ];

  const services = await Promise.all(
    checks.map(({ name, service, healthPath }) =>
      checkService(name, getServiceUrl(config, service), healthPath)
    )
  );

  const expired = isTokenExpired(config.sessionToken);
  const remaining = tokenTimeRemaining(config.sessionToken);

  return {
    services,
    token: { valid: !expired, remaining },
    allHealthy: services.every((s) => s.ok) && !expired,
  };
}

export function formatHealthReport(report: HealthReport): string {
  const lines: string[] = [];

  for (const svc of report.services) {
    const icon = svc.ok ? "\x1b[32m✓\x1b[0m" : "\x1b[31m✗\x1b[0m";
    const suffix = svc.error ? ` \x1b[31m(${svc.error})\x1b[0m` : "";
    lines.push(`  ${icon} ${svc.name.padEnd(12)} ${svc.url}${suffix}`);
  }

  const tokenIcon = report.token.valid ? "\x1b[32m✓\x1b[0m" : "\x1b[31m✗\x1b[0m";
  lines.push("");
  lines.push(`  ${tokenIcon} Session: ${report.token.valid ? "valid" : "EXPIRED"} (${report.token.remaining})`);

  if (!report.token.valid) {
    lines.push("");
    lines.push("  \x1b[33mSession token expired. Get a new one:\x1b[0m");
    lines.push("    1. Log into your BusiBox Portal in a browser");
    lines.push("    2. Open DevTools > Application > Cookies");
    lines.push('    3. Copy the "busibox-session" cookie value');
    lines.push("    4. Run: npm run dev:busibox:init");
  }

  const unreachable = report.services.filter((s) => !s.ok);
  if (unreachable.length > 0) {
    lines.push("");
    lines.push(`  \x1b[33m${unreachable.length} service(s) unreachable.\x1b[0m`);
    lines.push("  Check Tailscale connection and BusiBox status.");
    lines.push("  API calls to unreachable services will fail at runtime.");
  }

  return lines.join("\n");
}
