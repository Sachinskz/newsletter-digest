import { NextRequest, NextResponse } from "next/server";
import { requireAuthWithTokenExchange } from "@/lib/auth-middleware";
import { ensureDataDocuments, getLinkedInConnection } from "@/lib/data-api-client";

export async function GET(request: NextRequest) {
  const auth = await requireAuthWithTokenExchange(request, "data-api");
  if (auth instanceof NextResponse) return auth;

  const ids = await ensureDataDocuments(auth.apiToken);
  const connection = await getLinkedInConnection(auth.apiToken, ids.linkedinConnections);
  if (!connection) {
    return NextResponse.json({ connected: false });
  }

  return NextResponse.json({
    connected: connection.status === "active",
    status: connection.status,
    memberId: connection.memberId,
    memberName: connection.memberName,
    memberEmail: connection.memberEmail,
    accessTokenExpiresAt: connection.accessTokenExpiresAt,
    connectedAt: connection.connectedAt,
    lastUsedAt: connection.lastUsedAt,
  });
}
