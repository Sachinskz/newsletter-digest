import { describe, expect, it } from "vitest";
import { buildInjectedCookieHeader } from "@/dev-server/proxy";

describe("dev server cookie injection", () => {
  it("injects auth cookies when none are present", () => {
    expect(buildInjectedCookieHeader("", "token-123")).toBe("busibox-session=token-123; auth_token=token-123");
  });

  it("overwrites stale auth cookies while preserving unrelated cookies", () => {
    const header = buildInjectedCookieHeader("theme=dark; busibox-session=old; auth_token=older; other=value", "fresh");
    expect(header).toContain("theme=dark");
    expect(header).toContain("other=value");
    expect(header).toContain("busibox-session=fresh");
    expect(header).toContain("auth_token=fresh");
    expect(header).not.toContain("busibox-session=old");
    expect(header).not.toContain("auth_token=older");
  });
});
