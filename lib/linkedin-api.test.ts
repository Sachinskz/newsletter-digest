import { afterEach, describe, expect, it, vi } from "vitest";
import { createLinkedInTextPost, tokenHasExpired } from "./linkedin-api";

describe("linkedin api helpers", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("formats a personal text post request correctly", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("", {
        status: 201,
        headers: {
          "x-restli-id": "urn:li:share:12345",
        },
      }),
    );

    const result = await createLinkedInTextPost({
      accessToken: "access-token",
      memberId: "member-123",
      commentary: "Hello LinkedIn",
    });

    expect(result.postId).toBe("urn:li:share:12345");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const init = fetchMock.mock.calls[0]?.[1];
    expect(init?.method).toBe("POST");
    expect(init?.headers).toMatchObject({
      Authorization: "Bearer access-token",
      "Content-Type": "application/json",
    });
    expect(String(init?.body)).toContain('"author":"urn:li:person:member-123"');
    expect(String(init?.body)).toContain('"commentary":"Hello LinkedIn"');
  });

  it("marks expired tokens correctly", () => {
    expect(tokenHasExpired({ access_token: "token", expires_at: "2000-01-01T00:00:00.000Z" })).toBe(true);
    expect(tokenHasExpired({ access_token: "token", expires_at: "2999-01-01T00:00:00.000Z" })).toBe(false);
  });
});
