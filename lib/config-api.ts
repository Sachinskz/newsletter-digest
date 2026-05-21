import { exchangeTokenZeroTrust } from "@jazzmind/busibox-app";

const APP_ID = process.env.APP_NAME || "newsletter-digest";

export interface ConfigSetRequest {
  value: string;
  encrypted?: boolean;
  app_id?: string | null;
  tier?: string;
  category?: string | null;
  description?: string | null;
}

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, "");
}

function siblingServiceUrl(input: string | undefined, port: string): string | null {
  if (!input) return null;

  try {
    const parsed = new URL(input);
    parsed.port = port;
    return parsed.origin;
  } catch {
    return null;
  }
}

export function getConfigApiUrl(): string {
  if (process.env.CONFIG_API_URL) {
    return normalizeBaseUrl(process.env.CONFIG_API_URL);
  }

  if (process.env.CONFIG_API_HOST || process.env.CONFIG_API_PORT) {
    const host = process.env.CONFIG_API_HOST || "localhost";
    const port = process.env.CONFIG_API_PORT || "8012";
    return `http://${host}:${port}`;
  }

  const sibling =
    siblingServiceUrl(process.env.AUTHZ_BASE_URL, "8012")
    || siblingServiceUrl(process.env.DATA_API_URL, "8012")
    || siblingServiceUrl(process.env.AGENT_API_URL, "8012");

  if (sibling) {
    return sibling;
  }

  return "http://localhost:8012";
}

export async function getConfigApiToken(userId: string, sessionJwt: string): Promise<string> {
  void userId;
  const result = await exchangeTokenZeroTrust(
    {
      sessionJwt,
      audience: "config-api" as never,
      purpose: APP_ID,
    },
    {
      authzBaseUrl: process.env.AUTHZ_BASE_URL || "http://localhost:8010",
      verbose: process.env.VERBOSE_AUTHZ_LOGGING === "true",
    },
  );

  if (!result.accessToken) {
    throw new Error("Failed to obtain config-api token");
  }

  return result.accessToken;
}

async function configApiRequest<T>(
  token: string,
  method: "GET" | "PUT",
  path: string,
  body?: unknown,
): Promise<T> {
  const url = `${getConfigApiUrl()}${path}`;
  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`config-api ${response.status} ${method} ${path} via ${getConfigApiUrl()}: ${text}`);
  }

  return await response.json() as T;
}

export async function getAppConfig(token: string, appId: string): Promise<Record<string, string>> {
  const result = await configApiRequest<{ config: Record<string, string> }>(
    token,
    "GET",
    `/config/app/${encodeURIComponent(appId)}`,
  );
  return result.config;
}

export async function getAppConfigRaw(token: string, appId: string, key: string): Promise<string> {
  const result = await configApiRequest<{ value: string }>(
    token,
    "GET",
    `/config/app/${encodeURIComponent(appId)}/${encodeURIComponent(key)}/raw`,
  );
  return result.value;
}

export async function setConfig(token: string, key: string, data: ConfigSetRequest) {
  return await configApiRequest(
    token,
    "PUT",
    `/admin/config/${encodeURIComponent(key)}`,
    data,
  );
}
