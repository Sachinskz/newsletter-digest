import type { LinkedInProfile, LinkedInTokenSet } from "./types";

const LINKEDIN_API_BASE = "https://api.linkedin.com";
const LINKEDIN_POSTS_URL = `${LINKEDIN_API_BASE}/rest/posts`;
const LINKEDIN_USERINFO_URL = `${LINKEDIN_API_BASE}/v2/userinfo`;
const LINKEDIN_VERSION = process.env.LINKEDIN_API_VERSION || "202601";

function linkedInHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    "X-Restli-Protocol-Version": "2.0.0",
    "Linkedin-Version": LINKEDIN_VERSION,
  };
}

export async function getLinkedInProfile(accessToken: string): Promise<LinkedInProfile> {
  const res = await fetch(LINKEDIN_USERINFO_URL, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(`LinkedIn userinfo failed (${res.status}): ${JSON.stringify(data)}`);
  }

  return data as LinkedInProfile;
}

export async function createLinkedInTextPost(input: {
  accessToken: string;
  memberId: string;
  commentary: string;
}): Promise<{ postId: string }> {
  const payload = {
    author: `urn:li:person:${input.memberId}`,
    commentary: input.commentary,
    visibility: "PUBLIC",
    distribution: {
      feedDistribution: "MAIN_FEED",
      targetEntities: [],
      thirdPartyDistributionChannels: [],
    },
    lifecycleState: "PUBLISHED",
    isReshareDisabledByAuthor: false,
  };

  const res = await fetch(LINKEDIN_POSTS_URL, {
    method: "POST",
    headers: linkedInHeaders(input.accessToken),
    body: JSON.stringify(payload),
  });

  const rawText = await res.text();
  const parsed = rawText ? safeJson(rawText) : null;
  if (!res.ok) {
    throw new Error(`LinkedIn post publish failed (${res.status}): ${rawText.slice(0, 400)}`);
  }

  const postIdCandidate =
    (typeof parsed?.id === "string" ? parsed.id : null) ||
    res.headers.get("x-restli-id") ||
    res.headers.get("X-RestLi-Id") ||
    res.headers.get("location") ||
    res.headers.get("Location");

  if (!postIdCandidate) {
    throw new Error("LinkedIn publish succeeded but did not return a post id");
  }

  return { postId: postIdCandidate };
}

export function tokenHasExpired(tokens: LinkedInTokenSet): boolean {
  return new Date(tokens.expires_at).getTime() <= Date.now();
}

function safeJson(value: string): Record<string, unknown> | null {
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return null;
  }
}
