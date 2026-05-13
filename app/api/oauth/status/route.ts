import { NextRequest, NextResponse } from "next/server";
import { requireAuthWithTokenExchange } from "@/lib/auth-middleware";
import { ensureDataDocuments, getConnection } from "@/lib/data-api-client";

export async function GET(request: NextRequest) {
  const auth = await requireAuthWithTokenExchange(request, "data-api");
  if (auth instanceof NextResponse) return auth;

  const ids = await ensureDataDocuments(auth.apiToken);
  const connection = await getConnection(auth.apiToken, ids.connections);
  if (!connection) {
    return NextResponse.json({ connected: false });
  }

  return NextResponse.json({
    connected: connection.status === "active",
    status: connection.status,
    accountEmail: connection.accountEmail,
    accountName: connection.accountName,
    accessTokenExpiresAt: connection.accessTokenExpiresAt,
    connectedAt: connection.connectedAt,
    lastSyncAt: connection.lastSyncAt,
  });
}
