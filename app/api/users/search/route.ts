/**
 * ============================================
 * SHARING REFERENCE - User Search
 * ============================================
 *
 * GET /api/users/search?q=<query>
 *
 * Search for users to add to a team. Requires minimum 2 characters.
 * Proxies to authz self-service user search endpoint.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuthWithTokenExchange } from "@/lib/auth-middleware";
import { getSSOTokenFromRequest, searchUsers } from "@/lib/sharing";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuthWithTokenExchange(request, "data-api");
    if (auth instanceof NextResponse) return auth;

    const ssoToken = getSSOTokenFromRequest(request);
    if (!ssoToken) {
      return NextResponse.json({ users: [] });
    }

    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q") || "";
    if (q.length < 2) {
      return NextResponse.json({ users: [] });
    }

    const users = await searchUsers(ssoToken, q);
    return NextResponse.json({ users });
  } catch (error) {
    console.error("[API] GET /api/users/search error:", error);
    return NextResponse.json({ users: [] });
  }
}
