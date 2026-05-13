/**
 * ============================================
 * SHARING REFERENCE - Visibility Mode Management
 * ============================================
 *
 * GET  /api/settings/visibility — get current visibility mode
 * POST /api/settings/visibility — change visibility mode (body: { mode })
 *
 * Modes:
 *  - "private"  — only the document owner can access
 *  - "shared"   — any authenticated user in the app
 *  - "team"     — only users with the team role
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuthWithTokenExchange } from "@/lib/auth-middleware";
import { ensureDataDocuments } from "@/lib/data-api-client";
import {
  getSSOTokenFromRequest,
  getVisibilitySettings,
  setVisibility,
  type VisibilityMode,
} from "@/lib/sharing";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuthWithTokenExchange(request, "data-api");
    if (auth instanceof NextResponse) return auth;

    const ssoToken = getSSOTokenFromRequest(request);
    if (!ssoToken) {
      return NextResponse.json({ error: "No session token" }, { status: 401 });
    }

    const ids = await ensureDataDocuments(auth.apiToken);
    const firstDocId = Object.values(ids)[0];
    if (!firstDocId) {
      return NextResponse.json({ mode: "private", roleId: null, members: [] });
    }

    const settings = await getVisibilitySettings(
      auth.apiToken,
      ssoToken,
      firstDocId,
    );

    return NextResponse.json(settings);
  } catch (error) {
    console.error("[API] GET /api/settings/visibility error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuthWithTokenExchange(request, "data-api");
    if (auth instanceof NextResponse) return auth;

    const ssoToken = getSSOTokenFromRequest(request);
    if (!ssoToken) {
      return NextResponse.json({ error: "No session token" }, { status: 401 });
    }

    const body = await request.json();
    const mode = body.mode as VisibilityMode;
    if (!["private", "personal", "shared", "team"].includes(mode)) {
      return NextResponse.json(
        { error: "Invalid mode. Must be 'private', 'personal', 'shared', or 'team'" },
        { status: 400 },
      );
    }

    const ids = await ensureDataDocuments(auth.apiToken);
    const documentIds = Object.values(ids);
    const result = await setVisibility(
      auth.apiToken,
      ssoToken,
      documentIds,
      mode,
    );

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("[API] POST /api/settings/visibility error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
