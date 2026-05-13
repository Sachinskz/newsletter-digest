import { describe, expect, it } from "vitest";
import { htmlToText, normalizeEmailText } from "./html-to-text";

describe("htmlToText", () => {
  it("removes scripts and styles while preserving readable paragraphs", () => {
    const html = `
      <style>.hidden { display: none; }</style>
      <script>alert("x")</script>
      <h1>Weekly &amp; Useful</h1>
      <p>First paragraph&nbsp;with spacing.</p>
      <p>Second<br>line</p>
    `;

    const text = htmlToText(html);

    expect(text).toContain("Weekly & Useful");
    expect(text).toContain("First paragraph with spacing.");
    expect(text).toContain("Second\nline");
    expect(text).not.toContain("alert");
    expect(text).not.toContain("display");
  });

  it("truncates long text safely", () => {
    const text = htmlToText(`<p>${"a".repeat(100)}</p>`, 12);

    expect(text).toBe("aaaaaaaaaaaa\n\n[Truncated]");
  });

  it("normalizes plain text without html conversion", () => {
    expect(normalizeEmailText("  hello world  ", "text")).toBe("hello world");
  });
});
