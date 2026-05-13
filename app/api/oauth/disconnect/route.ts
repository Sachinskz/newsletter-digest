import { NextRequest, NextResponse } from "next/server";
import { requireAuthWithTokenExchange } from "@/lib/auth-middleware";
import { deleteConnection, ensureDataDocuments, getConnection } from "@/lib/data-api-client";
import { deleteKeystoreFile } from "@/lib/keystore";

export async function POST(request: NextRequest) {
  const auth = await requireAuthWithTokenExchange(request, "data-api");
  if (auth instanceof NextResponse) return auth;
  if (!auth.ssoToken) {
    return NextResponse.json({ error: "Missing Busibox session token" }, { status: 401 });
  }

  const ids = await ensureDataDocuments(auth.apiToken);
  const connection = await getConnection(auth.apiToken, ids.connections);
  if (connection) {
    await deleteKeystoreFile({ fileId: connection.tokenFileId, sessionJwt: auth.ssoToken });
    await deleteConnection(auth.apiToken, ids.connections);
  }

  return NextResponse.json({ success: true });
}
