import { afterEach, describe, expect, it } from "vitest";
import { getConfigApiUrl } from "./config-api";

const ORIGINAL_ENV = {
  CONFIG_API_URL: process.env.CONFIG_API_URL,
  CONFIG_API_HOST: process.env.CONFIG_API_HOST,
  CONFIG_API_PORT: process.env.CONFIG_API_PORT,
  AUTHZ_BASE_URL: process.env.AUTHZ_BASE_URL,
  DATA_API_URL: process.env.DATA_API_URL,
  AGENT_API_URL: process.env.AGENT_API_URL,
};

afterEach(() => {
  process.env.CONFIG_API_URL = ORIGINAL_ENV.CONFIG_API_URL;
  process.env.CONFIG_API_HOST = ORIGINAL_ENV.CONFIG_API_HOST;
  process.env.CONFIG_API_PORT = ORIGINAL_ENV.CONFIG_API_PORT;
  process.env.AUTHZ_BASE_URL = ORIGINAL_ENV.AUTHZ_BASE_URL;
  process.env.DATA_API_URL = ORIGINAL_ENV.DATA_API_URL;
  process.env.AGENT_API_URL = ORIGINAL_ENV.AGENT_API_URL;
});

describe("config api url resolution", () => {
  it("prefers CONFIG_API_URL when provided", () => {
    process.env.CONFIG_API_URL = "http://config-api.internal:8012/";
    delete process.env.CONFIG_API_HOST;
    delete process.env.CONFIG_API_PORT;
    delete process.env.AUTHZ_BASE_URL;

    expect(getConfigApiUrl()).toBe("http://config-api.internal:8012");
  });

  it("derives the config-api host from AUTHZ_BASE_URL when explicit config env is absent", () => {
    delete process.env.CONFIG_API_URL;
    delete process.env.CONFIG_API_HOST;
    delete process.env.CONFIG_API_PORT;
    process.env.AUTHZ_BASE_URL = "http://clymates-mac-studio.tail6d901e.ts.net:8010";

    expect(getConfigApiUrl()).toBe("http://clymates-mac-studio.tail6d901e.ts.net:8012");
  });
});
