import express from "express";
import { createProxyMiddleware } from "http-proxy-middleware";
import type { Server } from "http";
import { DevServerConfig } from "./config";

export interface ProxyServer {
  server: Server;
  close: () => Promise<void>;
}

export function startProxy(config: DevServerConfig): Promise<ProxyServer> {
  return new Promise((resolve, reject) => {
    const app = express();

    app.use(injectSessionCookies(config.sessionToken));

    const proxyMiddleware = createProxyMiddleware({
      target: `http://127.0.0.1:${config.nextDevPort}`,
      changeOrigin: false,
      on: {
        error(err, _req, res) {
          if ("writeHead" in res && typeof res.writeHead === "function") {
            const httpRes = res as express.Response;
            if (!httpRes.headersSent) {
              httpRes.status(502).json({
                error: "Next.js dev server not ready",
                message: "The dev server is still starting up. Refresh in a moment.",
              });
            }
          }
        },
      },
    });

    app.use(proxyMiddleware);

    const server = app.listen(config.appPort, () => {
      resolve({
        server,
        close: () =>
          new Promise<void>((res) => {
            server.close(() => res());
          }),
      });
    });

    server.on("error", (err: NodeJS.ErrnoException) => {
      if (err.code === "EADDRINUSE") {
        reject(
          new Error(
            `Port ${config.appPort} is already in use. Stop the other process or change appPort in .busibox-dev.json`
          )
        );
      } else {
        reject(err);
      }
    });

    // WebSocket upgrade for HMR
    server.on("upgrade", proxyMiddleware.upgrade!);
  });
}

function injectSessionCookies(sessionToken: string): express.RequestHandler {
  return (req, _res, next) => {
    req.headers.cookie = buildInjectedCookieHeader(req.headers.cookie || "", sessionToken);
    req.headers["x-busibox-dev-proxy"] = "1";
    next();
  };
}

export function buildInjectedCookieHeader(existing: string, sessionToken: string): string {
  const cookiesToInject: Record<string, string> = {
    "busibox-session": sessionToken,
    auth_token: sessionToken,
  };

  const remainingParts = existing
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part) => {
      const equalsIndex = part.indexOf("=");
      const name = equalsIndex >= 0 ? part.slice(0, equalsIndex).trim() : part;
      return !(name in cookiesToInject);
    });

  for (const [name, value] of Object.entries(cookiesToInject)) {
    remainingParts.push(`${name}=${value}`);
  }

  return remainingParts.join("; ");
}
