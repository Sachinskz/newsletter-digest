import { NextRequest, NextResponse } from "next/server";
import { requireAuthWithTokenExchange } from "@/lib/auth-middleware";
import { getAppConfig, getConfigApiToken, getConfigApiUrl, setConfig } from "@/lib/config-api";

const APP_ID = process.env.APP_NAME || "newsletter-digest";
const MS_KEYS = ["MS_CLIENT_ID", "MS_CLIENT_SECRET", "MS_TENANT_ID", "MS_SHARED_MAILBOX"] as const;

export async function GET(request: NextRequest) {
  const auth = await requireAuthWithTokenExchange(request, "data-api");
  if (auth instanceof NextResponse) return auth;
  if (!auth.ssoToken) {
    return NextResponse.json({ error: "SSO token required" }, { status: 401 });
  }

  try {
    const configToken = await getConfigApiToken(auth.userId, auth.ssoToken);
    const allConfig = await getAppConfig(configToken, APP_ID);

    return NextResponse.json({
      configured: MS_KEYS.every((key) => allConfig[key] && allConfig[key] !== "********" ? true : Boolean(allConfig[key])),
      configApiUrl: getConfigApiUrl(),
      keys: Object.fromEntries(
        MS_KEYS.map((key) => [key, allConfig[key] ? "configured" : "missing"]),
      ),
    });
  } catch (error) {
    console.error("[system/config] Failed to read config:", error);
    return NextResponse.json({
      configured: false,
      configApiUrl: getConfigApiUrl(),
      keys: {},
      error: error instanceof Error ? error.message : "Config API unavailable",
    });
  }
}

export async function PUT(request: NextRequest) {
  const auth = await requireAuthWithTokenExchange(request, "data-api");
  if (auth instanceof NextResponse) return auth;
  if (!auth.ssoToken) {
    return NextResponse.json({ error: "SSO token required" }, { status: 401 });
  }

  const body = await request.json();

  try {
    const configToken = await getConfigApiToken(auth.userId, auth.ssoToken);

    for (const key of MS_KEYS) {
      const value = body[key];
      if (typeof value === "string" && value.trim()) {
        await setConfig(configToken, key, {
          value: value.trim(),
          encrypted: key !== "MS_SHARED_MAILBOX",
          app_id: APP_ID,
          tier: "app",
          category: "microsoft",
        });
      }
    }

    return NextResponse.json({ saved: true, configApiUrl: getConfigApiUrl() });
  } catch (error) {
    console.error("[system/config] Failed to save config:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to save configuration",
        configApiUrl: getConfigApiUrl(),
      },
      { status: 500 },
    );
  }
}
