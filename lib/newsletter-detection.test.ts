import { describe, expect, it } from "vitest";
import { getHeaderMap, isNewsletter } from "./newsletter-detection";
import type { GraphMessageDetail } from "./types";

function message(overrides: Partial<GraphMessageDetail>): GraphMessageDetail {
  return {
    id: "m1",
    subject: "Hello",
    bodyPreview: "Quick personal note",
    from: { emailAddress: { address: "person@example.com", name: "Person" } },
    body: { contentType: "text", content: "Quick personal note" },
    ...overrides,
  };
}

describe("newsletter detection", () => {
  it("accepts messages with List-Unsubscribe headers", () => {
    expect(
      isNewsletter(
        message({
          internetMessageHeaders: [{ name: "List-Unsubscribe", value: "<mailto:unsubscribe@example.com>" }],
        }),
      ),
    ).toBe(true);
  });

  it("accepts known newsletter platforms", () => {
    expect(
      isNewsletter(
        message({
          from: { emailAddress: { address: "updates@company.substack.com" } },
        }),
      ),
    ).toBe(true);
  });

  it("uses combined subject, unsubscribe, and html heuristics", () => {
    expect(
      isNewsletter(
        message({
          subject: "Weekly product digest",
          body: { contentType: "html", content: `${"x".repeat(2600)} unsubscribe` },
        }),
      ),
    ).toBe(true);
  });

  it("rejects ordinary personal email", () => {
    expect(isNewsletter(message({ subject: "Lunch tomorrow?", bodyPreview: "Are you free at noon?" }))).toBe(false);
  });

  it("normalizes headers into lowercase names", () => {
    const headers = getHeaderMap(
      message({
        internetMessageHeaders: [{ name: "List-ID", value: "digest.example.com" }],
      }),
    );

    expect(headers.get("list-id")).toBe("digest.example.com");
  });
});
