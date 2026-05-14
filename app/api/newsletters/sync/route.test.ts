import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAuthWithTokenExchange: vi.fn(),
  createSummary: vi.fn(),
  ensureDataDocuments: vi.fn(),
  getConnection: vi.fn(),
  getEmailByMessageId: vi.fn(),
  getPreferences: vi.fn(),
  insertEmail: vi.fn(),
  listEmails: vi.fn(),
  markEmailSummarized: vi.fn(),
  updateConnectionStatus: vi.fn(),
  upsertConnection: vi.fn(),
  upsertSubscriptionFromEmail: vi.fn(),
  decryptForUser: vi.fn(),
  encryptForUser: vi.fn(),
  getMessageDetail: vi.fn(),
  listRecentMessages: vi.fn(),
  requestNewsletterSummary: vi.fn(),
  refreshIfNeeded: vi.fn(),
}));

vi.mock("@/lib/auth-middleware", () => ({
  requireAuthWithTokenExchange: mocks.requireAuthWithTokenExchange,
}));

vi.mock("@/lib/data-api-client", () => ({
  createSummary: mocks.createSummary,
  ensureDataDocuments: mocks.ensureDataDocuments,
  getConnection: mocks.getConnection,
  getEmailByMessageId: mocks.getEmailByMessageId,
  getPreferences: mocks.getPreferences,
  insertEmail: mocks.insertEmail,
  listEmails: mocks.listEmails,
  markEmailSummarized: mocks.markEmailSummarized,
  updateConnectionStatus: mocks.updateConnectionStatus,
  upsertConnection: mocks.upsertConnection,
  upsertSubscriptionFromEmail: mocks.upsertSubscriptionFromEmail,
}));

vi.mock("@/lib/keystore", () => ({
  decryptForUser: mocks.decryptForUser,
  encryptForUser: mocks.encryptForUser,
}));

vi.mock("@/lib/microsoft-graph", () => ({
  getMessageDetail: mocks.getMessageDetail,
  listRecentMessages: mocks.listRecentMessages,
  refreshIfNeeded: mocks.refreshIfNeeded,
}));

vi.mock("@/lib/newsletter-detection", () => ({
  isNewsletter: vi.fn(),
}));

vi.mock("@/lib/html-to-text", () => ({
  normalizeEmailText: vi.fn(),
}));

vi.mock("@/lib/summarization", async () => {
  const actual = await vi.importActual<typeof import("@/lib/summarization")>("@/lib/summarization");
  return {
    ...actual,
    requestNewsletterSummary: mocks.requestNewsletterSummary,
  };
});

import { POST } from "./route";
import { isNewsletter } from "@/lib/newsletter-detection";
import { normalizeEmailText } from "@/lib/html-to-text";

describe("newsletter sync route", () => {
  it("returns 401 when Microsoft is disconnected", async () => {
    mocks.requireAuthWithTokenExchange.mockResolvedValue({
      apiToken: "data-token",
      ssoToken: "session-token",
      userId: "user-1",
    });
    mocks.ensureDataDocuments.mockResolvedValue({
      connections: "connections-doc",
      emails: "emails-doc",
      subscriptions: "subscriptions-doc",
    });
    mocks.getConnection.mockResolvedValue(null);
    mocks.listEmails.mockResolvedValue([]);

    const response = await POST(new NextRequest("http://localhost:3002/api/newsletters/sync", { method: "POST" }));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe("Microsoft account is not connected");
    expect(mocks.decryptForUser).not.toHaveBeenCalled();
  });

  it("auto-summarizes newly inserted newsletters during sync", async () => {
    mocks.requireAuthWithTokenExchange
      .mockResolvedValueOnce({ apiToken: "data-token", ssoToken: "session-token", userId: "user-1" })
      .mockResolvedValueOnce({ apiToken: "agent-token" });
    mocks.ensureDataDocuments.mockResolvedValue({
      connections: "connections-doc",
      emails: "emails-doc",
      subscriptions: "subscriptions-doc",
      summaries: "summaries-doc",
      preferences: "preferences-doc",
    });
    mocks.getConnection.mockResolvedValue({
      encryptedTokens: "ciphertext",
      tokenFileId: "file-1",
      status: "active",
      accessTokenExpiresAt: "2026-05-15T10:00:00.000Z",
    });
    mocks.decryptForUser.mockResolvedValue(JSON.stringify({ access_token: "ms-token", expires_at: "2026-05-15T10:00:00.000Z" }));
    mocks.refreshIfNeeded.mockResolvedValue({
      tokens: { access_token: "ms-token", expires_at: "2026-05-15T10:00:00.000Z" },
      refreshed: false,
    });
    mocks.listRecentMessages.mockResolvedValue([{ id: "msg-1" }]);
    mocks.getMessageDetail.mockResolvedValue({
      id: "msg-1",
      subject: "AI policy update",
      body: { content: "<p>Important update</p>", contentType: "html" },
      bodyPreview: "Important update",
      receivedDateTime: "2026-05-14T09:00:00.000Z",
      from: { emailAddress: { address: "news@example.com", name: "AI News" } },
    });
    mocks.getEmailByMessageId.mockResolvedValue(null);
    mocks.insertEmail.mockResolvedValue({
      id: "email-1",
      senderEmail: "news@example.com",
      senderName: "AI News",
      subject: "AI policy update",
      receivedAt: "2026-05-14T09:00:00.000Z",
      bodyPlainText: "Important update",
      bodyLengthChars: 16,
      hasBeenSummarized: false,
      fetchedAt: "2026-05-14T09:01:00.000Z",
    });
    mocks.getPreferences.mockResolvedValue({ summaryFormat: "key_insights" });
    mocks.listEmails.mockResolvedValue([]);
    mocks.requestNewsletterSummary.mockResolvedValue({
      title: "Policy update",
      tldr: "Short brief",
      keyPoints: [{ point: "Main shift", importance: "high" }],
      actionItems: [{ action: "Review impact", urgency: "medium" }],
      sentiment: "neutral",
      topics: ["policy"],
      readTimeMinutes: 2,
    });
    mocks.createSummary.mockResolvedValue({ id: "summary-1" });

    vi.mocked(isNewsletter).mockReturnValue(true);
    vi.mocked(normalizeEmailText).mockReturnValue("Important update");

    const response = await POST(new NextRequest("http://localhost:3002/api/newsletters/sync", { method: "POST" }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.inserted).toBe(1);
    expect(body.summarized).toBe(1);
    expect(body.summaryFailures).toBe(0);
    expect(mocks.requestNewsletterSummary).toHaveBeenCalledWith(
      "agent-token",
      expect.objectContaining({ id: "email-1" }),
      "key_insights",
    );
    expect(mocks.markEmailSummarized).toHaveBeenCalledWith("data-token", "emails-doc", "email-1", "summary-1");
  });

  it("backfills existing unsummarized newsletters during sync without waiting on agent generation", async () => {
    mocks.requireAuthWithTokenExchange
      .mockResolvedValueOnce({ apiToken: "data-token", ssoToken: "session-token", userId: "user-1" })
      .mockResolvedValueOnce({ apiToken: "agent-token" });
    mocks.ensureDataDocuments.mockResolvedValue({
      connections: "connections-doc",
      emails: "emails-doc",
      subscriptions: "subscriptions-doc",
      summaries: "summaries-doc",
      preferences: "preferences-doc",
    });
    mocks.getConnection.mockResolvedValue({
      encryptedTokens: "ciphertext",
      tokenFileId: "file-1",
      status: "active",
      accessTokenExpiresAt: "2026-05-15T10:00:00.000Z",
    });
    mocks.decryptForUser.mockResolvedValue(JSON.stringify({ access_token: "ms-token", expires_at: "2026-05-15T10:00:00.000Z" }));
    mocks.refreshIfNeeded.mockResolvedValue({
      tokens: { access_token: "ms-token", expires_at: "2026-05-15T10:00:00.000Z" },
      refreshed: false,
    });
    mocks.listRecentMessages.mockResolvedValue([]);
    mocks.getPreferences.mockResolvedValue({ summaryFormat: "bullet_points" });
    mocks.insertEmail.mockReset();
    mocks.requestNewsletterSummary.mockReset();
    mocks.listEmails.mockResolvedValue([
      {
        id: "existing-1",
        senderEmail: "news@example.com",
        senderName: "AI News",
        subject: "Existing unsummarized item",
        receivedAt: "2026-05-14T09:00:00.000Z",
        bodyPlainText: "Important existing update",
        bodyLengthChars: 25,
        hasBeenSummarized: false,
        fetchedAt: "2026-05-14T09:01:00.000Z",
      },
    ]);
    mocks.createSummary.mockResolvedValue({ id: "summary-backfill-1" });
    mocks.upsertConnection.mockResolvedValue(undefined);
    mocks.upsertSubscriptionFromEmail.mockResolvedValue(undefined);
    mocks.getEmailByMessageId.mockResolvedValue(null);

    const response = await POST(new NextRequest("http://localhost:3002/api/newsletters/sync", { method: "POST" }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.inserted).toBe(0);
    expect(body.summarized).toBe(1);
    expect(body.summaryFailures).toBe(0);
    expect(mocks.requestNewsletterSummary).not.toHaveBeenCalled();
    expect(mocks.createSummary).toHaveBeenCalledWith(
      "data-token",
      "summaries-doc",
      "existing-1",
      expect.objectContaining({
        title: "Existing unsummarized item",
        sentiment: "neutral",
      }),
      "bullet_points",
    );
    expect(mocks.markEmailSummarized).toHaveBeenCalledWith("data-token", "emails-doc", "existing-1", "summary-backfill-1");
  });
});
