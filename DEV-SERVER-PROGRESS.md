# BusiBox Dev Server — Build Progress

> Local development server that proxies to a remote BusiBox instance via Tailscale,
> enabling hot-reload app development without running the full BusiBox stack locally.

## Status: IMPLEMENTATION COMPLETE — awaiting integration test with real BusiBox

Runtime behavior (auth flow, API calls, token exchange) has not been validated against
a live instance yet. See "Known Limitations" and "What's Next" below.

## Architecture

```
Developer's machine (Tailscale)
┌──────────────────────────────────────────────────┐
│                                                  │
│  Express reverse proxy (:3002)                   │
│  ├─ Injects busibox-session cookie               │
│  ├─ Injects auth_token cookie                    │
│  ├─ Handles WebSocket upgrade (HMR)              │
│  └─ Forwards everything to ↓                     │
│                                                  │
│  Next.js dev server (:3099, hot-reload)          │
│  ├─ App code with live editing                   │
│  ├─ ENV vars point API routes at remote ─────────────┐
│  └─ TEST_SESSION_JWT as server-side fallback     │    │
│                                                  │    │
└──────────────────────────────────────────────────┘    │
                                                         │ Tailscale
                                                         ▼
                                             ┌───────────────────────┐
                                             │  Remote BusiBox       │
                                             │  AuthZ    :8010       │
                                             │  Data API :8002       │
                                             │  Agent API:8000       │
                                             │  Search   :8003       │
                                             │  Portal   :3000       │
                                             └───────────────────────┘
```

## How It Works

1. Developer runs `npm run dev:busibox:init` — enters BusiBox Tailscale IP and session token
2. Developer runs `npm run dev:busibox` — starts the dev server
3. Express proxy listens on `:3002` (the app's normal port)
4. Next.js dev server starts on `:3099` (internal, not accessed directly)
5. Every browser request to `:3002` gets `busibox-session` and `auth_token` cookies injected, then proxied to Next.js
6. Next.js API routes use env vars (`AUTHZ_BASE_URL`, `DATA_API_URL`, etc.) pointing at the remote BusiBox via Tailscale
7. `TEST_SESSION_JWT` is set for server-side auth fallback
8. WebSocket upgrade is handled for Next.js HMR (hot module reload)

**Zero changes to app source code.** The proxy + env vars handle everything.

## Requirements

| # | Requirement | Notes |
|---|---|---|
| 1 | Node.js 18+ | Already needed for Next.js |
| 2 | Tailscale connected | Access to company tailnet |
| 3 | Remote BusiBox reachable | Verify with `curl http://<ip>:8010/health` |
| 4 | Valid session JWT | From Portal `busibox-session` cookie |
| 5 | BusiBox Tailscale IP/hostname | e.g., `100.x.x.x` |
| 6 | `@jazzmind/busibox-app` access | Needs `GITHUB_AUTH_TOKEN` |

**NOT required:** Docker, PostgreSQL, Redis, Milvus, MinIO, Ansible, vault passwords, SSH keys, nginx.

## Usage

```bash
# First time — interactive setup
npm run dev:busibox:init
# Enter your BusiBox Tailscale IP and session token

# Start developing
npm run dev:busibox
# Opens http://localhost:3002 with hot-reload + real BusiBox backend
```

## Known Limitations

### 1. This is a development tool, not a production-faithful simulator

The dev server validates **feature behavior** (CRUD works, agents respond, search returns
results). It does **not** faithfully reproduce the production auth path. Specifically:

- **Double auth fallback**: The proxy injects cookies for client-side auth, and
  `TEST_SESSION_JWT` provides a server-side fallback. If cookie injection or
  `SessionProvider` behavior is broken, server-side routes still work silently.
  This means "API calls succeed" does not prove "the production auth flow works."
- **Production auth testing requires deploying to a real BusiBox** via the normal
  `make install SERVICE=<app>` path.

### 2. Token shape is portal-scoped, not app-scoped

The setup tells developers to copy the Portal's `busibox-session` cookie. This is the
**portal-level session JWT**, which does not contain an `app_id` claim. In production,
the normal flow is:

1. User clicks app in Portal
2. Portal exchanges session JWT for an **app-scoped token** (with `app_id` claim)
3. App receives the app-scoped token

Because the dev server injects the portal token directly, `getAppResourceId()` returns
`null` and downstream token exchanges are **unscoped** — the user gets all their roles,
not just app-bound ones.

**Impact:**
- Basic CRUD, agent calls, search: **work correctly**
- Team-sharing, app-bound RBAC (`/api/team`, `/api/settings/visibility`): **may diverge
  from production** because role scoping is different

**Future fix:** Have the dev server exchange the portal session JWT for an app-scoped
token via AuthZ during `init`, or add an `appId` field to the config that gets passed
to token exchange calls.

### 3. Logout and session lifecycle cannot be tested

The proxy re-injects `busibox-session` and `auth_token` cookies on every incoming
request. This means:

- Clicking "logout" clears cookies, but the next request gets them re-injected
- You cannot test session expiry, cookie clearing, or refresh behavior
- "What happens when the user's session disappears" is untestable

This is inherent to the cookie-injection approach. To test auth lifecycle, deploy
to a real BusiBox.

### 5. Direct access to the internal Next.js port causes auth loops

The internal Next.js server on `:3099` does not receive the dev proxy's injected
cookies. If a browser lands on `http://localhost:3099/...` directly, `SessionProvider`
can treat the session as missing or expired and bounce the user into a redirect loop.

The dev server now protects against this in two ways:

- The proxy **overwrites** stale `busibox-session` and `auth_token` cookies with the
  configured dev token instead of preserving old browser values.
- A lightweight app-level proxy redirect sends direct `:3099` requests back to the
  public proxy port (`:3002`), including normalizing `/home?reason=session_expired`
  back to `/`.

This makes switching browser state less fragile, but true multi-account auth lifecycle
testing still belongs on a real BusiBox deployment rather than the local cookie-injection
dev runner.

### 4. Security tradeoffs (acceptable for internal development)

This tool makes two explicit security compromises for developer convenience:

- **Plaintext session JWT**: The `.busibox-dev.json` file stores a raw session JWT
  in plaintext on disk. This file is gitignored, but anyone with filesystem access
  can read it. **Do not use production tokens.** Use a staging/development instance.
- **TLS verification disabled**: `NODE_TLS_REJECT_UNAUTHORIZED=0` is set for the
  entire Next.js child process. This allows connections to BusiBox instances with
  self-signed certificates (common on internal networks), but means MITM attacks
  are not detected. **Never use this setting in production.**

## Files Created

| File | Purpose | Status |
|---|---|---|
| `dev-server/index.ts` | CLI entry point + orchestrator + dashboard | Done |
| `dev-server/config.ts` | Read/write/validate `.busibox-dev.json` + token utils | Done |
| `dev-server/proxy.ts` | Express reverse proxy with cookie injection + WebSocket | Done |
| `dev-server/health.ts` | Pre-flight connectivity checks for all remote services | Done |
| `dev-server/next-launcher.ts` | Spawns `next dev` as child process with correct env vars | Done |
| `dev-server/setup.ts` | Interactive `init` flow with connectivity checks | Done |
| `DEV-SERVER-PROGRESS.md` | This file | Done |

## Files Modified

| File | Change | Status |
|---|---|---|
| `package.json` | Added `dev:busibox` and `dev:busibox:init` scripts; added `express`, `http-proxy-middleware` to dependencies; added `@types/express` to devDependencies | Done |
| `.gitignore` | Added `.busibox-dev.json`, `.busibox-dev-data.json` | Done |

## Dependencies Added

| Package | Version | Type | Why |
|---|---|---|---|
| `express` | ^5.1.0 | dependency | Reverse proxy server — most battle-tested Node.js server (15+ years production use) |
| `http-proxy-middleware` | ^4.0.0 | dependency | Industry standard proxy middleware — used by CRA, Vite, etc. |
| `@types/express` | ^5 | devDependency | TypeScript types for Express v5 |

## Config File: `.busibox-dev.json`

Created by `npm run dev:busibox:init`. Gitignored (contains session token).

```json
{
  "remote": {
    "host": "100.64.0.5",
    "protocol": "http",
    "authzPort": 8010,
    "dataApiPort": 8002,
    "agentApiPort": 8000,
    "searchApiPort": 8003,
    "portalPort": 3000
  },
  "sessionToken": "eyJhbGciOi...",
  "appPort": 3002,
  "nextDevPort": 3099
}
```

## Env Vars Set by Dev Server

These are injected into the Next.js child process — no `.env.local` needed:

| Variable | Value | Purpose |
|---|---|---|
| `AUTHZ_BASE_URL` | `http://<host>:8010` | Token validation + exchange |
| `DATA_API_URL` | `http://<host>:8002` | CRUD storage |
| `AGENT_API_URL` | `http://<host>:8000` | AI agents + chat |
| `SEARCH_API_URL` | `http://<host>:8003` | Semantic search |
| `NEXT_PUBLIC_BUSIBOX_PORTAL_URL` | `http://<host>:3000` | SSO + branding |
| `TEST_SESSION_JWT` | `<session token>` | Server-side auth fallback |
| `NODE_ENV` | `development` | Next.js dev mode |
| `PORT` | `3099` | Internal Next.js port |
| `NODE_TLS_REJECT_UNAUTHORIZED` | `0` | **Security tradeoff** — allows self-signed certs on internal networks, disables MITM detection |

## Validation Results

| Check | Result |
|---|---|
| TypeScript compilation (strict mode) | Pass — zero errors |
| All module imports | Pass — all 5 modules load and export correctly |
| Config creation + validation | Pass — defaults, overrides, port validation all work |
| Token expiry detection | Pass — correctly identifies expired vs. valid tokens |
| Service URL generation | Pass — correct format with host/port/protocol |
| No-config error path | Pass — clean error message directing to `init` |
| package.json validity | Pass — valid JSON with all entries |
| .gitignore entries | Pass — both dev-server files excluded |

## Build Log

### Phase 1: Scaffolding
- [x] Created `dev-server/` directory
- [x] `dev-server/config.ts` — Config schema, read/write/validate, token expiry utils

### Phase 2: Health Checks
- [x] `dev-server/health.ts` — Parallel connectivity checks to all 5 remote services + token validation

### Phase 3: Reverse Proxy
- [x] `dev-server/proxy.ts` — Express proxy with cookie injection, WebSocket upgrade for HMR, 502 handling when Next.js is starting
- [x] Fixed: Updated `http-proxy-middleware` from v3 to v4 (v3 doesn't exist), removed deprecated `ws: true` option

### Phase 4: Next.js Launcher
- [x] `dev-server/next-launcher.ts` — Child process spawner with env var injection, ready detection, graceful shutdown

### Phase 5: Orchestrator + Dashboard
- [x] `dev-server/index.ts` — Entry point with header, health checks, startup sequence, ready dashboard, graceful shutdown

### Phase 6: Interactive Setup
- [x] `dev-server/setup.ts` — Interactive init with connectivity probing, token validation, .gitignore update

### Phase 7: Integration
- [x] `package.json` — Added scripts (`dev:busibox`, `dev:busibox:init`) and dependencies
- [x] `.gitignore` — Added `.busibox-dev.json`, `.busibox-dev-data.json`
- [x] Fixed: Duplicate `remote` key in `createConfig` (TS1117)
- [x] All validations passing

## What's Next (after Tailscale access is available)

1. **Integration test**: Run `npm run dev:busibox:init` pointing at a real BusiBox
2. **Verify auth flow**: Confirm `SessionProvider` sees the injected cookies and authenticates
3. **Verify API calls**: Test Data API CRUD, Agent API chat, Search API queries
4. **Fix token scoping** (if needed): Exchange portal session for app-scoped token during init
5. **Token refresh**: If session tokens expire frequently, add auto-refresh support
6. **Portal redirect handling**: If `SessionProvider` still tries to redirect to Portal login, may need to intercept that client-side redirect
