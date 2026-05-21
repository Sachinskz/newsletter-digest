import { getConfigApiToken, getAppConfigRaw } from "@jazzmind/busibox-app/lib";

const APP_ID = process.env.APP_NAME || "newsletter-digest";
const MS_CONFIG_KEYS = ["MS_CLIENT_ID", "MS_CLIENT_SECRET", "MS_TENANT_ID", "MS_SHARED_MAILBOX"] as const;

export interface SharedMailboxCredentials {
  clientId: string;
  clientSecret: string;
  tenantId: string;
  sharedMailbox: string;
}

function fromEnv(): SharedMailboxCredentials | null {
  const clientId = process.env.MS_CLIENT_ID;
  const clientSecret = process.env.MS_CLIENT_SECRET;
  const tenantId = process.env.MS_TENANT_ID;
  const sharedMailbox = process.env.MS_SHARED_MAILBOX;
  if (clientId && clientSecret && tenantId && sharedMailbox) {
    return { clientId, clientSecret, tenantId, sharedMailbox };
  }
  return null;
}

export function isSharedMailboxConfiguredFromEnv(): boolean {
  return fromEnv() !== null;
}

export async function loadSharedMailboxCredentials(
  userId: string,
  sessionJwt: string,
): Promise<SharedMailboxCredentials | null> {
  const envCreds = fromEnv();
  if (envCreds) return envCreds;

  try {
    console.log("[ms-config] Attempting Config API lookup for user:", userId);
    const configToken = await getConfigApiToken(userId, sessionJwt);
    console.log("[ms-config] Got config-api token, fetching keys...");
    const values: Record<string, string> = {};
    for (const key of MS_CONFIG_KEYS) {
      try {
        values[key] = await getAppConfigRaw(configToken, APP_ID, key);
        console.log(`[ms-config] ${key}: loaded`);
      } catch (keyError) {
        console.warn(`[ms-config] ${key}: not found -`, keyError instanceof Error ? keyError.message : keyError);
      }
    }

    const hasAll = values.MS_CLIENT_ID && values.MS_CLIENT_SECRET && values.MS_TENANT_ID && values.MS_SHARED_MAILBOX;
    console.log("[ms-config] Keys present:", Object.keys(values).join(", "), "| complete:", Boolean(hasAll));

    if (hasAll) {
      return {
        clientId: values.MS_CLIENT_ID,
        clientSecret: values.MS_CLIENT_SECRET,
        tenantId: values.MS_TENANT_ID,
        sharedMailbox: values.MS_SHARED_MAILBOX,
      };
    }
  } catch (error) {
    console.error("[ms-config] Config API lookup failed:", error instanceof Error ? error.message : error);
  }

  return null;
}

export async function acquireAppOnlyTokenWithCredentials(creds: SharedMailboxCredentials): Promise<string> {
  const tokenUrl = `https://login.microsoftonline.com/${creds.tenantId}/oauth2/v2.0/token`;
  const body = new URLSearchParams({
    client_id: creds.clientId,
    client_secret: creds.clientSecret,
    grant_type: "client_credentials",
    scope: "https://graph.microsoft.com/.default",
  });

  const res = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Client credentials token request failed (${res.status}): ${JSON.stringify(data)}`);
  }

  return data.access_token;
}
