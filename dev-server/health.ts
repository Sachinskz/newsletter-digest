import { DevServerConfig, getServiceUrl, isTokenExpired, tokenTimeRemaining } from "./config";

interface ServiceCheck {
  name: string;
  url: string;
  ok: boolean;
  error?: string;
}

interface HealthReport {
  services: ServiceCheck[];
  token: { valid: boolean; remaining: string; reason?: string };
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

async function validateSessionToken(config: DevServerConfig): Promise<{ valid: boolean; reason?: string }> {
  const params = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:token-exchange",
    subject_token: config.sessionToken,
    subject_token_type: "urn:ietf:params:oauth:token-type:jwt",
    audience: "data-api",
  });

  try {
    const response = await fetch(`${getServiceUrl(config, "authzPort")}/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });

    if (response.ok) {
      return { valid: true };
    }

    const bodyText = await response.text();
    try {
      const parsed = JSON.parse(bodyText);
      return {
        valid: false,
        reason: String(parsed.detail || parsed.error || bodyText || `status_${response.status}`),
      };
    } catch {
      return {
        valid: false,
        reason: bodyText || `status_${response.status}`,
      };
    }
  } catch (error) {
    return {
      valid: false,
      reason: error instanceof Error ? error.message : String(error),
    };
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
  const tokenValidation = expired
    ? { valid: false, reason: "expired" }
    : await validateSessionToken(config);

  return {
    services,
    token: { valid: tokenValidation.valid, remaining, reason: tokenValidation.reason },
    allHealthy: services.every((s) => s.ok) && tokenValidation.valid,
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
  const tokenStatus = report.token.valid
    ? "valid"
    : report.token.reason === "expired"
      ? "EXPIRED"
      : "INVALID";
  const reasonSuffix = report.token.reason && report.token.reason !== "expired"
    ? ` — ${report.token.reason}`
    : "";
  lines.push(`  ${tokenIcon} Session: ${tokenStatus} (${report.token.remaining})${reasonSuffix}`);

  if (!report.token.valid) {
    lines.push("");
    lines.push("  \x1b[33mSession token is not usable. Get a new one:\x1b[0m");
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
