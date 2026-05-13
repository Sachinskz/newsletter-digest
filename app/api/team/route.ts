/**
 * ============================================
 * SHARING REFERENCE - Team Member Management
 * ============================================
 *
 * GET    /api/team — list team members
 * POST   /api/team — add a user to the team (body: { userId })
 * DELETE /api/team — remove a user from the team (body: { userId })
 *
 * Requires the app to be in "team" visibility mode. Use
 * /api/settings/visibility to switch modes.
 *
 * Auth: Uses SSO session JWT (busibox-session cookie) for authz calls,
 * and data-api token for document operations.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuthWithTokenExchange } from "@/lib/auth-middleware";
import { ensureDataDocuments } from "@/lib/data-api-client";
import {
  getSSOTokenFromRequest,
  getVisibilitySettings,
  ensureAppTeamRole,
  addRoleToDocuments,
  listTeamMembers,
  addTeamMember,
  removeTeamMember,
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
      return NextResponse.json({ members: [], roleId: null });
    }

    const settings = await getVisibilitySettings(
      auth.apiToken,
      ssoToken,
      firstDocId,
    );

    return NextResponse.json({
      members: settings.members,
      roleId: settings.roleId,
    });
  } catch (error) {
    console.error("[API] GET /api/team error:", error);
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

    const body = (await request.json()) as { userId?: string };
    if (!body.userId) {
      return NextResponse.json(
        { error: "userId is required" },
        { status: 400 },
      );
    }

    const ids = await ensureDataDocuments(auth.apiToken);
    const role = await ensureAppTeamRole(ssoToken);
    await addRoleToDocuments(
      auth.apiToken,
      role.roleId,
      Object.values(ids),
    );
    await addTeamMember(ssoToken, role.roleId, body.userId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[API] POST /api/team error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireAuthWithTokenExchange(request, "data-api");
    if (auth instanceof NextResponse) return auth;

    const ssoToken = getSSOTokenFromRequest(request);
    if (!ssoToken) {
      return NextResponse.json({ error: "No session token" }, { status: 401 });
    }

    const body = (await request.json()) as { userId?: string };
    if (!body.userId) {
      return NextResponse.json(
        { error: "userId is required" },
        { status: 400 },
      );
    }

    const ids = await ensureDataDocuments(auth.apiToken);
    const firstDocId = Object.values(ids)[0];
    if (!firstDocId) {
      return NextResponse.json(
        { error: "No documents configured" },
        { status: 400 },
      );
    }

    const settings = await getVisibilitySettings(
      auth.apiToken,
      ssoToken,
      firstDocId,
    );
    if (!settings.roleId) {
      return NextResponse.json(
        { error: "Team sharing is not enabled" },
        { status: 400 },
      );
    }

    await removeTeamMember(ssoToken, settings.roleId, body.userId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[API] DELETE /api/team error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
