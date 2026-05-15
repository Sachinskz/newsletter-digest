import { NextRequest, NextResponse } from "next/server";
import { requireAuthWithTokenExchange } from "@/lib/auth-middleware";
import {
  ensureDataDocuments,
  getGeneratedContentById,
  getLinkedInConnection,
  updateGeneratedContent,
  updateLinkedInConnection,
  updateLinkedInConnectionStatus,
} from "@/lib/data-api-client";
import { createLinkedInTextPost, tokenHasExpired } from "@/lib/linkedin-api";
import { decryptForUser } from "@/lib/keystore";
import type { LinkedInTokenSet } from "@/lib/types";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuthWithTokenExchange(request, "data-api");
  if (auth instanceof NextResponse) return auth;
  if (!auth.ssoToken) {
    return NextResponse.json({ error: "Missing Busibox session token" }, { status: 401 });
  }

  const { id } = await params;
  const ids = await ensureDataDocuments(auth.apiToken);
  const draft = await getGeneratedContentById(auth.apiToken, ids.generatedContent, id);
  if (!draft) {
    return NextResponse.json({ error: "Generated draft not found" }, { status: 404 });
  }
  if (draft.kind !== "linkedin") {
    return NextResponse.json({ error: "Only LinkedIn drafts can be published to LinkedIn" }, { status: 400 });
  }

  const connection = await getLinkedInConnection(auth.apiToken, ids.linkedinConnections);
  if (!connection || connection.status !== "active") {
    return NextResponse.json({ error: "LinkedIn account is not connected" }, { status: 401 });
  }

  let tokens: LinkedInTokenSet;
  try {
    const decrypted = await decryptForUser({
      encryptedContent: connection.encryptedTokens,
      fileId: connection.tokenFileId,
      sessionJwt: auth.ssoToken,
    });
    tokens = JSON.parse(decrypted) as LinkedInTokenSet;
  } catch (error) {
    await updateLinkedInConnectionStatus(auth.apiToken, ids.linkedinConnections, "revoked");
    return NextResponse.json(
      {
        error: "LinkedIn token decrypt failed",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 502 },
    );
  }

  if (tokenHasExpired(tokens)) {
    await updateLinkedInConnectionStatus(auth.apiToken, ids.linkedinConnections, "expired");
    return NextResponse.json({ error: "LinkedIn connection expired. Reconnect to publish." }, { status: 401 });
  }

  await updateGeneratedContent(auth.apiToken, ids.generatedContent, draft.id, {
    channel: "linkedin",
    publishStatus: "publishing",
    publishError: "",
    publishTarget: "personal_profile",
  });

  try {
    const result = await createLinkedInTextPost({
      accessToken: tokens.access_token,
      memberId: connection.memberId,
      commentary: draft.body,
    });
    const now = new Date().toISOString();
    const content = await updateGeneratedContent(auth.apiToken, ids.generatedContent, draft.id, {
      channel: "linkedin",
      publishStatus: "published",
      publishError: "",
      publishTarget: "personal_profile",
      publishedAt: now,
      externalPostId: result.postId,
      publishedByUserId: auth.userId,
    });
    await updateLinkedInConnection(auth.apiToken, ids.linkedinConnections, { lastUsedAt: now });
    return NextResponse.json({ content, externalPostId: result.postId });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.toLowerCase().includes("401") || message.toLowerCase().includes("unauthorized")) {
      await updateLinkedInConnectionStatus(auth.apiToken, ids.linkedinConnections, "expired");
    }
    const content = await updateGeneratedContent(auth.apiToken, ids.generatedContent, draft.id, {
      channel: "linkedin",
      publishStatus: "failed",
      publishError: message,
      publishTarget: "personal_profile",
    });
    return NextResponse.json(
      {
        error: "Failed to publish LinkedIn draft",
        details: message,
        content,
      },
      { status: 502 },
    );
  }
}
