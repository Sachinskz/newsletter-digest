import { createInterface } from "readline";
import { createConfig, writeConfig, getTokenExpiry, isTokenExpired, tokenTimeRemaining } from "./config";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

function prompt(rl: ReturnType<typeof createInterface>, question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => resolve(answer.trim()));
  });
}

export async function runSetup(projectRoot: string): Promise<void> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });

  console.log("");
  console.log("  \x1b[1mBusiBox Dev Server Setup\x1b[0m");
  console.log("  ─────────────────────────────────");
  console.log("");

  try {
    // 1. Get remote host
    const host = await prompt(
      rl,
      "  Remote BusiBox host (Tailscale IP or hostname):\n  > "
    );

    if (!host) {
      console.log("\n  \x1b[31mHost is required.\x1b[0m");
      process.exit(1);
    }

    // 2. Check connectivity
    console.log("\n  Checking connectivity...");

    const services = [
      { name: "AuthZ", port: 8010, path: "/health" },
      { name: "Data API", port: 8002, path: "/health" },
      { name: "Agent API", port: 8000, path: "/health" },
      { name: "Search API", port: 8003, path: "/health" },
      { name: "Portal", port: 3000, path: "/portal/api/health" },
    ];

    for (const svc of services) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        const res = await fetch(`http://${host}:${svc.port}${svc.path}`, {
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (res.ok) {
          console.log(`  \x1b[32m✓\x1b[0m ${svc.name} reachable at ${host}:${svc.port}`);
        } else {
          console.log(`  \x1b[33m⚠\x1b[0m ${svc.name} responded with ${res.status} at ${host}:${svc.port}`);
        }
      } catch {
        console.log(`  \x1b[31m✗\x1b[0m ${svc.name} unreachable at ${host}:${svc.port}`);
      }
    }

    // 3. Get session token
    console.log("");
    console.log("  To get your session token:");
    console.log(`    1. Open http://${host}:3000 in your browser`);
    console.log("    2. Log in to the BusiBox Portal");
    console.log("    3. Open DevTools > Application > Cookies");
    console.log('    4. Copy the "busibox-session" cookie value');
    console.log("");

    const sessionToken = await prompt(rl, "  Session token (paste the cookie value):\n  > ");

    if (!sessionToken) {
      console.log("\n  \x1b[31mSession token is required.\x1b[0m");
      process.exit(1);
    }

    // 4. Validate token
    if (isTokenExpired(sessionToken)) {
      console.log("\n  \x1b[31m✗ Token is expired.\x1b[0m Get a fresh one from the Portal.");
      process.exit(1);
    }

    const remaining = tokenTimeRemaining(sessionToken);
    console.log(`  \x1b[32m✓\x1b[0m Token valid, expires in ${remaining}`);

    // 5. Write config
    const config = createConfig(host, sessionToken);
    writeConfig(projectRoot, config);
    console.log(`  \x1b[32m✓\x1b[0m Config written to .busibox-dev.json`);

    // 6. Update .gitignore
    ensureGitignore(projectRoot);
    console.log(`  \x1b[32m✓\x1b[0m .gitignore updated`);

    console.log("");
    console.log('  Run \x1b[1mnpm run dev:busibox\x1b[0m to start developing!');
    console.log("");
  } finally {
    rl.close();
  }
}

function ensureGitignore(projectRoot: string): void {
  const gitignorePath = join(projectRoot, ".gitignore");
  const entries = [".busibox-dev.json", ".busibox-dev-data.json"];

  let content = "";
  if (existsSync(gitignorePath)) {
    content = readFileSync(gitignorePath, "utf-8");
  }

  const missing = entries.filter((entry) => !content.includes(entry));
  if (missing.length === 0) return;

  const section = [
    "",
    "# BusiBox dev server",
    ...missing,
    "",
  ].join("\n");

  writeFileSync(gitignorePath, content.trimEnd() + "\n" + section, "utf-8");
}
