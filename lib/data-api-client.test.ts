import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getNow: vi.fn(),
  insertRecords: vi.fn(),
  queryRecords: vi.fn(),
  updateRecords: vi.fn(),
}));

vi.mock("@jazzmind/busibox-app", () => ({
  deleteRecords: vi.fn(),
  ensureDocuments: vi.fn(),
  generateId: vi.fn(() => "generated-id"),
  getNow: mocks.getNow,
  insertRecords: mocks.insertRecords,
  queryRecords: mocks.queryRecords,
  updateRecords: mocks.updateRecords,
}));

import { DEFAULT_PREFERENCES_ID, getPreferences, upsertPreferences } from "./data-api-client";

describe("preferences data helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getNow.mockReturnValue("2026-05-13T10:00:00.000Z");
  });

  it("returns null when no preferences exist", async () => {
    mocks.queryRecords.mockResolvedValue({ records: [] });

    await expect(getPreferences("token", "preferences-doc")).resolves.toBeNull();
  });

  it("creates preferences on first save", async () => {
    mocks.queryRecords.mockResolvedValue({ records: [] });

    const preferences = await upsertPreferences("token", "preferences-doc", "key_insights");

    expect(preferences).toEqual({
      id: DEFAULT_PREFERENCES_ID,
      summaryFormat: "key_insights",
      createdAt: "2026-05-13T10:00:00.000Z",
      updatedAt: "2026-05-13T10:00:00.000Z",
    });
    expect(mocks.insertRecords).toHaveBeenCalledWith("token", "preferences-doc", [preferences]);
    expect(mocks.updateRecords).not.toHaveBeenCalled();
  });

  it("updates existing preferences while preserving createdAt", async () => {
    mocks.queryRecords.mockResolvedValue({
      records: [
        {
          id: DEFAULT_PREFERENCES_ID,
          summaryFormat: "bullet_points",
          createdAt: "2026-05-12T10:00:00.000Z",
          updatedAt: "2026-05-12T10:00:00.000Z",
        },
      ],
    });

    const preferences = await upsertPreferences("token", "preferences-doc", "full_digest");

    expect(preferences.createdAt).toBe("2026-05-12T10:00:00.000Z");
    expect(preferences.summaryFormat).toBe("full_digest");
    expect(mocks.updateRecords).toHaveBeenCalled();
    expect(mocks.insertRecords).not.toHaveBeenCalled();
  });
});
