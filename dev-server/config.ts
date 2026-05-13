import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

const CONFIG_FILENAME = ".busibox-dev.json";

export interface DevServerConfig {
  remote: {
    host: string;
    protocol: "http" | "https";
    authzPort: number;
    dataApiPort: number;
    agentApiPort: number;
    searchApiPort: number;
    portalPort: number;
  };
  sessionToken: string;
  appPort: number;
  nextDevPort: number;
}

const DEFAULT_CONFIG: Omit<DevServerConfig, "remote" | "sessionToken"> = {
  appPort: 3002,
  nextDevPort: 3099,
};

const DEFAULT_PORTS = {
  authzPort: 8010,
  dataApiPort: 8002,
  agentApiPort: 8000,
  searchApiPort: 8003,
  portalPort: 3000,
};

export function getConfigPath(projectRoot: string): string {
  return join(projectRoot, CONFIG_FILENAME);
}

export function configExists(projectRoot: string): boolean {
  return existsSync(getConfigPath(projectRoot));
}

export function readConfig(projectRoot: string): DevServerConfig {
  const configPath = getConfigPath(projectRoot);

  if (!existsSync(configPath)) {
    throw new Error(
      `Config file not found: ${configPath}\nRun "npm run dev:busibox:init" to create one.`
    );
  }

  const raw = readFileSync(configPath, "utf-8");
  let parsed: Record<string, unknown>;

  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`Invalid JSON in ${configPath}`);
  }

  return validateConfig(parsed);
}

export function writeConfig(
  projectRoot: string,
  config: DevServerConfig
): void {
  const configPath = getConfigPath(projectRoot);
  writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n", "utf-8");
}

export function createConfig(
  host: string,
  sessionToken: string,
  overrides?: Partial<DevServerConfig>
): DevServerConfig {
  const remote = {
    host,
    protocol: "http" as const,
    ...DEFAULT_PORTS,
    ...overrides?.remote,
  };

  return {
    ...DEFAULT_CONFIG,
    ...overrides,
    remote,
    sessionToken,
  };
}

function validateConfig(raw: Record<string, unknown>): DevServerConfig {
  const remote = raw.remote as Record<string, unknown> | undefined;

  if (!remote || typeof remote.host !== "string" || !remote.host) {
    throw new Error("Config missing remote.host");
  }

  if (typeof raw.sessionToken !== "string" || !raw.sessionToken) {
    throw new Error(
      "Config missing sessionToken. Get one from your BusiBox Portal's busibox-session cookie."
    );
  }

  return {
    remote: {
      host: remote.host,
      protocol:
        remote.protocol === "https" ? "https" : "http",
      authzPort: toPort(remote.authzPort, DEFAULT_PORTS.authzPort),
      dataApiPort: toPort(remote.dataApiPort, DEFAULT_PORTS.dataApiPort),
      agentApiPort: toPort(remote.agentApiPort, DEFAULT_PORTS.agentApiPort),
      searchApiPort: toPort(remote.searchApiPort, DEFAULT_PORTS.searchApiPort),
      portalPort: toPort(remote.portalPort, DEFAULT_PORTS.portalPort),
    },
    sessionToken: raw.sessionToken as string,
    appPort: toPort(raw.appPort, DEFAULT_CONFIG.appPort),
    nextDevPort: toPort(raw.nextDevPort, DEFAULT_CONFIG.nextDevPort),
  };
}

function toPort(value: unknown, fallback: number): number {
  if (typeof value === "number" && value > 0 && value < 65536) return value;
  return fallback;
}

export function getServiceUrl(config: DevServerConfig, service: keyof typeof DEFAULT_PORTS): string {
  const { protocol, host } = config.remote;
  const port = config.remote[service];
  return `${protocol}://${host}:${port}`;
}

export function getTokenExpiry(token: string): Date | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(
      Buffer.from(parts[1], "base64url").toString("utf-8")
    );
    if (typeof payload.exp !== "number") return null;
    return new Date(payload.exp * 1000);
  } catch {
    return null;
  }
}

export function isTokenExpired(token: string): boolean {
  const expiry = getTokenExpiry(token);
  if (!expiry) return false; // can't determine — assume valid
  return expiry.getTime() < Date.now();
}

export function tokenTimeRemaining(token: string): string {
  const expiry = getTokenExpiry(token);
  if (!expiry) return "unknown";

  const ms = expiry.getTime() - Date.now();
  if (ms <= 0) return "expired";

  const hours = Math.floor(ms / 3_600_000);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);

  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}
