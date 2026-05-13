import { createHash } from "crypto";
import { exchangeTokenZeroTrust } from "@jazzmind/busibox-app";

const KEYSTORE_AUDIENCE = "authz-api";

export function tokenFileIdForConnection(connectionId: string): string {
  const hash = createHash("sha1").update(`newsletter-digest:${connectionId}`).digest("hex");
  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    `4${hash.slice(13, 16)}`,
    `${((parseInt(hash.slice(16, 18), 16) & 0x3f) | 0x80).toString(16)}${hash.slice(18, 20)}`,
    hash.slice(20, 32),
  ].join("-");
}

export async function encryptForUser(input: {
  plaintext: string;
  fileId: string;
  sessionJwt: string;
  userId: string;
}): Promise<string> {
  const token = await getAuthzApiToken(input.sessionJwt);
  const res = await fetch(`${getAuthzBaseUrl()}/keystore/encrypt`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      file_id: input.fileId,
      content: Buffer.from(input.plaintext, "utf-8").toString("base64"),
      user_id: input.userId,
      role_ids: [],
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(`AuthZ keystore encrypt failed (${res.status}): ${JSON.stringify(data)}`);
  }
  return data.encrypted_content;
}

export async function decryptForUser(input: {
  encryptedContent: string;
  fileId: string;
  sessionJwt: string;
}): Promise<string> {
  const token = await getAuthzApiToken(input.sessionJwt);
  const res = await fetch(`${getAuthzBaseUrl()}/keystore/decrypt`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      file_id: input.fileId,
      encrypted_content: input.encryptedContent,
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(`AuthZ keystore decrypt failed (${res.status}): ${JSON.stringify(data)}`);
  }
  return Buffer.from(data.content, "base64").toString("utf-8");
}

export async function deleteKeystoreFile(input: {
  fileId: string;
  sessionJwt: string;
}): Promise<void> {
  const token = await getAuthzApiToken(input.sessionJwt);
  await fetch(`${getAuthzBaseUrl()}/keystore/file/${input.fileId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  }).catch(() => {});
}

async function getAuthzApiToken(sessionJwt: string): Promise<string> {
  const result = await exchangeTokenZeroTrust(
    {
      sessionJwt,
      audience: KEYSTORE_AUDIENCE as never,
      purpose: "newsletter-digest",
    },
    {
      authzBaseUrl: getAuthzBaseUrl(),
      verbose: process.env.VERBOSE_AUTHZ_LOGGING === "true",
    },
  );
  return result.accessToken;
}

function getAuthzBaseUrl(): string {
  return process.env.AUTHZ_BASE_URL || "http://localhost:8010";
}
