import { resolve } from "path";
import { readConfig, configExists, getServiceUrl, tokenTimeRemaining, isTokenExpired } from "./config";
import { runHealthChecks, formatHealthReport } from "./health";
import { startProxy } from "./proxy";
import { launchNextDev } from "./next-launcher";
import { runSetup } from "./setup";

const PROJECT_ROOT = resolve(__dirname, "..");

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  // Handle "init" subcommand
  if (args[0] === "init") {
    await runSetup(PROJECT_ROOT);
    return;
  }

  // Require config
  if (!configExists(PROJECT_ROOT)) {
    console.error("");
    console.error("  \x1b[31mNo .busibox-dev.json found.\x1b[0m");
    console.error("  Run \x1b[1mnpm run dev:busibox:init\x1b[0m to set up the dev server.");
    console.error("");
    process.exit(1);
  }

  const config = readConfig(PROJECT_ROOT);

  // Print header
  printHeader(config);

  // Check token expiry
  if (isTokenExpired(config.sessionToken)) {
    console.error("  \x1b[31mSession token is expired.\x1b[0m");
    console.error("  Run \x1b[1mnpm run dev:busibox:init\x1b[0m to configure a new token.");
    console.error("");
    process.exit(1);
  }

  // Run health checks
  console.log("  Checking remote BusiBox services...\n");
  const report = await runHealthChecks(config);
  console.log(formatHealthReport(report));
  console.log("");

  if (!report.allHealthy) {
    console.log("  \x1b[33mSome services are unreachable. Continuing anyway...\x1b[0m");
    console.log("  (API calls to unreachable services will fail at runtime)");
    console.log("");
  }

  // Start Next.js dev server
  console.log("  Starting Next.js dev server...\n");
  const next = launchNextDev(config, PROJECT_ROOT);

  // Start Express proxy
  let proxy: Awaited<ReturnType<typeof startProxy>> | null = null;

  try {
    // Wait for Next.js to be ready before printing the "ready" message
    await Promise.race([
      next.waitForReady(),
      new Promise<void>((_, reject) =>
        setTimeout(() => reject(new Error("Next.js did not start within 60s")), 60_000)
      ),
    ]);

    proxy = await startProxy(config);

    console.log("");
    printReady(config, report);
  } catch (err) {
    // If Next.js isn't ready yet, start the proxy anyway — it will return 502 until Next.js is up
    if (!proxy) {
      try {
        proxy = await startProxy(config);
        console.log("");
        console.log(`  \x1b[33mProxy ready at http://localhost:${config.appPort}\x1b[0m`);
        console.log("  Waiting for Next.js to finish starting...");
      } catch (proxyErr) {
        console.error(`  \x1b[31mFailed to start proxy:\x1b[0m ${proxyErr}`);
        next.kill();
        process.exit(1);
      }
    }
  }

  // Graceful shutdown
  const shutdown = () => {
    console.log("\n  Shutting down...");
    next.kill();
    proxy?.close();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  // Keep the process alive
  next.process.on("exit", (code) => {
    console.log(`\n  Next.js exited with code ${code}.`);
    proxy?.close();
    process.exit(code ?? 1);
  });
}

function printHeader(config: ReturnType<typeof readConfig>): void {
  console.log("");
  console.log("  \x1b[1m┌─────────────────────────────────────────────┐\x1b[0m");
  console.log("  \x1b[1m│  BusiBox Dev Server                         │\x1b[0m");
  console.log("  \x1b[1m└─────────────────────────────────────────────┘\x1b[0m");
  console.log("");
  console.log(`  Remote:  ${config.remote.host}`);
  console.log(`  Token:   ${tokenTimeRemaining(config.sessionToken)} remaining`);
  console.log("");
}

function printReady(
  config: ReturnType<typeof readConfig>,
  report: Awaited<ReturnType<typeof runHealthChecks>>
): void {
  const healthy = report.services.filter((s) => s.ok).length;
  const total = report.services.length;

  console.log("  \x1b[1m┌─────────────────────────────────────────────┐\x1b[0m");
  console.log("  \x1b[1m│  Ready                                      │\x1b[0m");
  console.log("  \x1b[1m└─────────────────────────────────────────────┘\x1b[0m");
  console.log("");
  console.log(`  \x1b[1mApp:\x1b[0m       http://localhost:${config.appPort}`);
  console.log(`  \x1b[1mNext.js:\x1b[0m   http://localhost:${config.nextDevPort} (internal)`);
  console.log(`  \x1b[1mRemote:\x1b[0m    ${config.remote.host} (${healthy}/${total} services up)`);
  console.log(`  \x1b[1mSession:\x1b[0m   ${tokenTimeRemaining(config.sessionToken)} remaining`);
  console.log("");
  console.log(`  Open \x1b[4mhttp://localhost:${config.appPort}\x1b[0m in your browser.`);
  console.log("  Press Ctrl+C to stop.\n");
}

main().catch((err) => {
  console.error(`\n  \x1b[31mFatal error:\x1b[0m ${err.message || err}`);
  process.exit(1);
});
