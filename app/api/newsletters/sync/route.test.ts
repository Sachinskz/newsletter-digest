import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAuthWithTokenExchange: vi.fn(),
  ensureDataDocuments: vi.fn(),
  getConnection: vi.fn(),
  getEmailByMessageId: vi.fn(),
  insertEmail: vi.fn(),
  updateConnectionStatus: vi.fn(),
  upsertConnection: vi.fn(),
  upsertSubscriptionFromEmail: vi.fn(),
  decryptForUser: vi.fn(),
  encryptForUser: vi.fn(),
  getMessageDetail: vi.fn(),
  listRecentMessages: vi.fn(),
  refreshIfNeeded: vi.fn(),
}));

vi.mock("@/lib/auth-middleware", () => ({
  requireAuthWithTokenExchange: mocks.requireAuthWithTokenExchange,
}));

vi.mock("@/lib/data-api-client", () => ({
  ensureDataDocuments: mocks.ensureDataDocuments,
  getConnection: mocks.getConnection,
  getEmailByMessageId: mocks.getEmailByMessageId,
  insertEmail: mocks.insertEmail,
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

import { POST } from "./route";

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

    const response = await POST(new NextRequest("http://localhost:3002/api/newsletters/sync", { method: "POST" }));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe("Microsoft account is not connected");
    expect(mocks.decryptForUser).not.toHaveBeenCalled();
  });
});
