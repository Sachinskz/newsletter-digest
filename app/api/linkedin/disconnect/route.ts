import { NextRequest, NextResponse } from "next/server";
import { requireAuthWithTokenExchange } from "@/lib/auth-middleware";
import { deleteLinkedInConnection, ensureDataDocuments, getLinkedInConnection } from "@/lib/data-api-client";
import { deleteKeystoreFile } from "@/lib/keystore";

export async function POST(request: NextRequest) {
  const auth = await requireAuthWithTokenExchange(request, "data-api");
  if (auth instanceof NextResponse) return auth;
  if (!auth.ssoToken) {
    return NextResponse.json({ error: "Missing Busibox session token" }, { status: 401 });
  }

  const ids = await ensureDataDocuments(auth.apiToken);
  const connection = await getLinkedInConnection(auth.apiToken, ids.linkedinConnections);
  if (connection) {
    await deleteKeystoreFile({ fileId: connection.tokenFileId, sessionJwt: auth.ssoToken });
    await deleteLinkedInConnection(auth.apiToken, ids.linkedinConnections);
  }

  return NextResponse.json({ disconnected: true });
}
