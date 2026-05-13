import { spawn, ChildProcess } from "child_process";
import { DevServerConfig, getServiceUrl } from "./config";

export interface NextProcess {
  process: ChildProcess;
  kill: () => void;
  waitForReady: () => Promise<void>;
}

export function launchNextDev(
  config: DevServerConfig,
  projectRoot: string
): NextProcess {
  const env = buildEnv(config);

  const child = spawn("npx", ["next", "dev", "-p", String(config.nextDevPort)], {
    cwd: projectRoot,
    env: { ...process.env, ...env },
    stdio: ["ignore", "pipe", "pipe"],
    shell: true,
  });

  let ready = false;
  const readyPromiseCallbacks: { resolve: () => void; reject: (err: Error) => void } | null = {
    resolve: () => {},
    reject: () => {},
  };

  const readyPromise = new Promise<void>((resolve, reject) => {
    readyPromiseCallbacks!.resolve = resolve;
    readyPromiseCallbacks!.reject = reject;
  });

  child.stdout?.on("data", (data: Buffer) => {
    const line = data.toString();
    process.stdout.write(`  \x1b[2m[next]\x1b[0m ${line}`);

    if (!ready && (line.includes("Ready in") || line.includes("started server"))) {
      ready = true;
      readyPromiseCallbacks!.resolve();
    }
  });

  child.stderr?.on("data", (data: Buffer) => {
    const line = data.toString();
    // Next.js sends some normal output to stderr (like the URL line)
    if (line.includes("- Local:") || line.includes("Ready in")) {
      process.stdout.write(`  \x1b[2m[next]\x1b[0m ${line}`);
      if (!ready) {
        ready = true;
        readyPromiseCallbacks!.resolve();
      }
    } else {
      process.stderr.write(`  \x1b[31m[next]\x1b[0m ${line}`);
    }
  });

  child.on("exit", (code) => {
    if (!ready) {
      readyPromiseCallbacks!.reject(
        new Error(`Next.js exited with code ${code} before becoming ready`)
      );
    }
  });

  return {
    process: child,
    kill: () => {
      if (!child.killed) {
        child.kill("SIGTERM");
      }
    },
    waitForReady: () => readyPromise,
  };
}

function buildEnv(config: DevServerConfig): Record<string, string> {
  const portalUrl = getServiceUrl(config, "portalPort");

  return {
    // Point all service URLs at the remote BusiBox via Tailscale
    AUTHZ_BASE_URL: getServiceUrl(config, "authzPort"),
    DATA_API_URL: getServiceUrl(config, "dataApiPort"),
    AGENT_API_URL: getServiceUrl(config, "agentApiPort"),
    SEARCH_API_URL: getServiceUrl(config, "searchApiPort"),

    // Portal URL for SSO redirects and branding
    NEXT_PUBLIC_BUSIBOX_PORTAL_URL: portalUrl,

    // Server-side fallback: when no cookie is present, API routes use this
    TEST_SESSION_JWT: config.sessionToken,

    // Standard Next.js dev settings
    NODE_ENV: "development",
    PORT: String(config.nextDevPort),
    DEV_INTERNAL_PORT: String(config.nextDevPort),
    DEV_PROXY_PORT: String(config.appPort),

    // Allow self-signed certs on Tailscale/internal networks
    NODE_TLS_REJECT_UNAUTHORIZED: "0",
  };
}
