# Newsletter Digest — Developer Handoff

**Last updated:** 2026-05-15  
**App:** `newsletter-digest` — BusiBox app  
**Repo:** https://github.com/Sachinskz/newsletter-digest  
**BusiBox repo:** https://github.com/jazzmind/busibox

---

## What This App Is

Newsletter Digest is a BusiBox app that:

1. Connects a user's Microsoft 365 mailbox via OAuth
2. Syncs newsletters from their inbox and detects them via heuristics
3. Generates AI-powered structured summaries (title, TLDR, key points, actions, sentiment)
4. Scores articles by importance/novelty/urgency
5. Matches articles to client profiles for outreach relevance
6. Generates LinkedIn posts, client emails, thought leadership from matched articles
7. (Partial) Publishes directly to LinkedIn

Each user's data is fully isolated — `visibility: "personal"` on all 8 data documents.

---

## Running Locally

```bash
# In busibox-template/ directory (NOT the app dir)
npm exec tsx dev-server/index.ts --project /path/to/newsletter-digest

# Dev proxy: http://localhost:3002
# Next.js dev: http://localhost:3099
# Config file: newsletter-digest/.busibox-dev.json (has session token)
```

The dev server injects the `busibox-session` cookie from `.busibox-dev.json` into every request, so you stay authenticated against the remote Mac Studio backend.

When the session token expires (~24–48h), get a new one from the BusiBox Portal's cookie.

---

## Infrastructure (Mac Studio)

| Service | Host | Port |
|---------|------|------|
| BusiBox Portal | `clymates-mac-studio.tail6d901e.ts.net` | 3000 |
| AuthZ | same | 8010 |
| Agent API | same | 8000 |
| Data API | same | 8002 |
| LiteLLM | proxied through agent-api | — |

SSH is blocked on Mac Studio (connection refused). Deployments must be done by pulling git on the Mac Studio directly or via the BusiBox CLI.

---

## App Pages (Navigation)

| Page | Route | Status |
|------|-------|--------|
| Dashboard | `/` | ✅ Working — loads summaries + articles, connection CTA if not connected |
| Ingest | `/ingest` | ✅ Working — Microsoft connect, sync, newsletter list |
| Article Library | `/library` | ✅ Working — scored grid, filters, client relevance badges |
| Client Relevance | `/clients` | ✅ Working — CRUD client profiles, article match display |
| Content Generator | `/generate` | ✅ Working — LinkedIn/email/thought content, LinkedIn post |
| Settings | `/settings` | ✅ Working — Microsoft + LinkedIn OAuth, summary format |

Legacy routes (`/newsletters`, `/newsletters/[id]`, `/format`) exist but are NOT in the sidebar.

---

## Data Documents (8)

All `visibility: "personal"` — user-isolated via PostgreSQL RLS.

| Document key | Purpose |
|---|---|
| `newsletter-digest-connections` | Microsoft account + encrypted token blob |
| `newsletter-digest-subscriptions` | Discovered sender metadata |
| `newsletter-digest-emails` | Synced newsletter content (plain text, sender, subject) |
| `newsletter-digest-summaries` | AI summaries (title, tldr, keyPoints JSON, actionItems JSON, topics JSON) |
| `newsletter-digest-preferences` | User's preferred summary format |
| `newsletter-digest-generated-content` | AI-generated drafts (LinkedIn, email, etc.) |
| `newsletter-digest-clients` | Client profiles (name, sector, topics, priorities) |
| `newsletter-digest-client-matches` | Persisted article↔client relevance scores |

Note: `keyPoints`, `actionItems`, `topics` are stored as **JSON strings** in data-api (the schema type is `string`). Parse them with `JSON.parse()` when reading.

---

## Key Lib Files

| File | What it does |
|------|-------------|
| `lib/data-api-client.ts` | All 8 schemas + CRUD helpers (createSummary, listSummaries, etc.) |
| `lib/types.ts` | All TypeScript interfaces |
| `lib/summarization.ts` | Newsletter summarization — agent-first → OpenRouter fallback |
| `lib/editorial-intelligence.ts` | Article scoring (importance/novelty/urgency), category derivation, `deriveLibraryArticles()` |
| `lib/content-generation.ts` | Content kinds/tones, prompt builder, generate via OpenRouter/agent-api |
| `lib/microsoft-oauth.ts` | PKCE, auth URL builder, token exchange |
| `lib/microsoft-graph.ts` | Graph API — fetch messages, token refresh |
| `lib/newsletter-detection.ts` | Newsletter heuristics (List-Unsubscribe header, known domains) |
| `lib/html-to-text.ts` | Strip HTML to plain text before summarization |
| `lib/linkedin-oauth.ts` | LinkedIn PKCE OAuth flow |
| `lib/linkedin-api.ts` | LinkedIn post publish via REST API (has TypeScript bug — see Issues) |
| `lib/keystore.ts` | BusiBox keystore bridge — encrypt/decrypt OAuth tokens |
| `lib/auth-middleware.ts` | `requireAuthWithTokenExchange()` — use in every API route |
| `lib/client-relevance.ts` | Deterministic article↔client matching logic |

---

## Summarization Pipeline (Current State)

```
requestNewsletterSummary()
  → POST /runs/invoke (agent-api, agent_name: "newsletter-analyst")
      → Claude Sonnet 4.6 [ONLY WORKS IF AGENT IS DEPLOYED ON MAC STUDIO]
  → on failure → directLLMSummarize()
      → OpenRouter (deepseek/deepseek-v4-flash:free) [free, slow ~16s]
      → or agent-api /llm/completions if no OPENROUTER_API_KEY
```

**Critical: the newsletter-analyst agent is NOT yet deployed on Mac Studio.** It exists only in the local busibox repo commit. Until deployed, all summarizations fall back to OpenRouter DeepSeek.

Input truncation: 6000 chars. Timeout: 120s.

---

## The BusiBox Newsletter Analyst Agent

**What was built:**
- `busibox/srv/agent/app/agents/newsletter_analyst_agent.py` — production-quality agent using Claude Sonnet 4.6, Pydantic structured output, tuned system prompt
- Tested: 43/43 newsletters, 100% schema validation pass rate, avg 13.9s, ~$0.016/newsletter
- Unit tests: `busibox/srv/agent/tests/unit/test_newsletter_analyst_agent.py`

**LiteLLM model changes** (`busibox/config/litellm-config.yaml`):
- `frontier`: was AWS Bedrock → now `anthropic/claude-sonnet-4-6` (direct API)
- `fallback`: was AWS Bedrock Haiku → now `anthropic/claude-sonnet-4-6`
- Requires `ANTHROPIC_API_KEY` env var on Mac Studio

**To deploy on Mac Studio:**
```bash
# 1. Push busibox commit 828e4b53 (needs jazzmind org GitHub credentials)
cd busibox && git push origin main

# 2. On Mac Studio — add to agent-api and litellm environment:
ANTHROPIC_API_KEY=<set-a-valid-anthropic-api-key-in-env>

# 3. Restart services
make manage SERVICE=litellm,agent ACTION=restart

# 4. Verify
curl http://localhost:8000/agents | python3 -m json.tool | grep newsletter
```

---

## Current Data State (sachin.m@maigent.ai)

- **43 newsletters** synced, **43/43 summarized** with Claude Sonnet 4.6 quality
- Summaries were bulk-loaded from pre-generated test results (not live agent calls)
- Other users start empty — they need to connect their own Outlook and sync

Sample topic quality from new summaries:
- `['US-China AI Policy', 'Anthropic vs. OpenAI Enterprise Share', 'Samsung Strike / HBM Supply']`
- `['NVIDIA Cosmos 2.5', 'Physical AI & Robotics', 'Robot Dexterity Scaling']`
- `['Canvas Ransomware Breach', 'EdTech Cybersecurity', 'EU AI Classroom Regulation']`

---

## Environment Variables

### Local dev (`.env.local`)

```bash
# BusiBox core
APP_NAME=newsletter-digest
NEXT_PUBLIC_BUSIBOX_PORTAL_URL=http://clymates-mac-studio.tail6d901e.ts.net:3000
AUTHZ_BASE_URL=http://clymates-mac-studio.tail6d901e.ts.net:8010
DATA_API_URL=http://clymates-mac-studio.tail6d901e.ts.net:8002
AGENT_API_URL=http://clymates-mac-studio.tail6d901e.ts.net:8000

# Microsoft OAuth (Azure app 4b79b4e6-85d1-4070-ac3a-68ab18605fbd)
MS_CLIENT_ID=4b79b4e6-85d1-4070-ac3a-68ab18605fbd
MS_CLIENT_SECRET=<in .env.local>
MS_REDIRECT_URI=http://localhost:3002/api/oauth/callback  # change for production

# LinkedIn OAuth
LINKEDIN_CLIENT_ID=86ihi8psxodyaz
LINKEDIN_CLIENT_SECRET=<in .env.local>
LINKEDIN_REDIRECT_URI=http://localhost:3002/api/linkedin/callback  # change for production

# LLM fallback (free tier — has rate limits)
OPENROUTER_API_KEY=sk-or-v1-...
OPENROUTER_MODEL=deepseek/deepseek-v4-flash:free

# BusiBox agent (primary path)
NEWSLETTER_SUMMARY_AGENT_NAME=newsletter-analyst
NEWSLETTER_SUMMARY_AGENT_TIER=complex
```

### Mac Studio (add to agent-api + litellm)

```bash
ANTHROPIC_API_KEY=sk-ant-api03-...   # Required for frontier model
```

---

## Known Issues & Production Gaps

These are ordered by priority. See `docs/production-readiness-roadmap.md` for full detail.

### 🔴 Must fix before real usage

**1. Content generation trusts browser-supplied data**  
`POST /api/content/generate` accepts full article context from the browser. Fix: accept only `articleId` + `clientId`, load from data-api server-side.

**2. `GET /api/client-relevance` writes on reads**  
Every load of the client relevance page recomputes and rewrites ALL client matches. Expensive, broken for scale. Fix: move refresh to sync trigger / client create/update.

**3. Debug route in production**  
`/api/debug/summarize/[id]` is present with no environment gate. Remove or gate behind `NODE_ENV !== 'production'`.

**4. Summary provenance not tracked**  
No way to tell if a summary is AI-generated, fallback, or regenerated. Users see identical display for garbage and quality output. Fix: add `summarySource: 'ai' | 'fallback'` field.

**5. `linkedin-api.ts` TypeScript error**  
`createLinkedInTextPost` returns `{}` where `{ postId: string }` is expected when the API doesn't return a body. TypeScript error in `lib/linkedin-api.ts:74`. Build will warn.

### 🟡 Important but not immediate blockers

**6. Editorial scoring is fully heuristic**  
`importance`, `novelty`, `urgency` in `editorial-intelligence.ts` are keyword-frequency heuristics. They work but are not personalized and hard to tune. Should eventually be LLM-assisted.

**7. Client relevance matching is deterministic only**  
`client-relevance.ts` does text overlap scoring. Good enough for MVP, but won't catch semantic matches. Should be LLM-scored eventually.

**8. No draft approval workflow**  
Generated content goes straight to "ready". No `draft → review → approved → sent` state machine. Required before any real client-facing outreach.

**9. Multi-article LinkedIn post not supported**  
Current flow: 1 article → 1 post. The product roadmap wants multi-story clustering. Not built yet.

**10. OpenRouter free model rate limits**  
`deepseek/deepseek-v4-flash:free` is the fallback LLM. It works but has rate limits and ~16s latency. Once the newsletter-analyst agent is deployed on Mac Studio, this becomes the emergency fallback only.

---

## API Routes Reference

### OAuth (Microsoft)
| Route | Method | Purpose |
|-------|--------|---------|
| `/api/oauth/authorize` | GET | Build MS auth URL (PKCE + state), redirect |
| `/api/oauth/callback` | GET | Exchange code, encrypt tokens, store connection |
| `/api/oauth/status` | GET | Return connection status |
| `/api/oauth/disconnect` | POST | Delete tokens + connection record |

### Newsletters
| Route | Method | Purpose |
|-------|--------|---------|
| `/api/newsletters/sync` | POST | Fetch from Graph API, detect newsletters, store |
| `/api/newsletters` | GET | List all stored newsletters |
| `/api/newsletters/[id]` | GET | Single newsletter detail |
| `/api/newsletters/[id]/summarize` | POST | Generate/regenerate AI summary. `?force=true` to replace existing |

### Summaries & Content
| Route | Method | Purpose |
|-------|--------|---------|
| `/api/summaries` | GET | List all summaries |
| `/api/content/generate` | POST | Generate LinkedIn/email/thought content |
| `/api/content` | GET | List generated drafts |
| `/api/client-relevance` | GET | Get article↔client match scores (also refreshes — see issue #2) |

### LinkedIn
| Route | Method | Purpose |
|-------|--------|---------|
| `/api/linkedin/authorize` | GET | LinkedIn OAuth start |
| `/api/linkedin/callback` | GET | Token exchange + store |
| `/api/linkedin/status` | GET | Connection status |
| `/api/linkedin/disconnect` | POST | Revoke + delete |
| `/api/linkedin/publish` | POST | Publish a generated draft to LinkedIn |

### Settings & Misc
| Route | Method | Purpose |
|-------|--------|---------|
| `/api/preferences` | GET, PUT | Summary format preference |
| `/api/clients` | GET, POST | Client profiles CRUD |
| `/api/clients/[id]` | PATCH, DELETE | Update/delete client |
| `/api/setup` | POST | Bootstrap all 8 data documents |
| `/api/debug/summarize/[id]` | POST | ⚠️ Debug only — remove before production |

---

## BusiBox Patterns (Important)

**Every API route must use token exchange:**
```typescript
const auth = await requireAuthWithTokenExchange(request, "data-api");
if (auth instanceof NextResponse) return auth;
// use auth.apiToken for data-api calls

const agentAuth = await requireAuthWithTokenExchange(request, "agent-api");
// use agentAuth.apiToken for agent-api calls
```

**The `session_revoked` error** is a known intermittent issue with the zero-trust token exchange in the framework. It usually clears on retry. Do not try to work around it by caching tokens.

**Never call data-api or agent-api directly from client components.** Always go through your own app's API routes, which do the token exchange.

**Data documents are lazily initialized** via `ensureDataDocuments()`. Always call this at the top of every API route before querying.

---

## Content Generation Pipeline

```
/api/content/generate
  → loads article context from browser (⚠️ not server-verified yet)
  → builds prompt via buildContentPrompt()
  → POST to OpenRouter (OPENROUTER_API_KEY set) or agent-api /llm/completions
  → validates JSON via GENERATED_CONTENT_SCHEMA
  → stores in newsletter-digest-generated-content document
```

The content generation still uses OpenRouter as the primary (not the BusiBox agent). This should be migrated to a `content-generator` BusiBox agent following the same pattern as `newsletter-analyst`.

---

## Tests

```bash
npm test              # runs all tests (jest)
npm run test:watch    # watch mode
```

Test files are co-located in `lib/` (`*.test.ts`). Coverage is good for utilities, sparse for API routes.

Known passing: html-to-text, newsletter-detection, editorial-intelligence, data-api-client, microsoft-oauth, content-generation  
Known issue: `linkedin-api.test.ts` may fail due to the TypeScript bug in `createLinkedInTextPost`

---

## Next Development Priorities

In order of impact:

1. **Deploy newsletter-analyst agent on Mac Studio** (see deployment steps above) — immediately improves all future summarizations for all users

2. **Fix content generation trust boundary** — `POST /api/content/generate` should load article from data-api by ID, not trust browser payload

3. **Add summary provenance** — add `summarySource` field so UI can show AI vs fallback badges

4. **Move client relevance refresh off read path** — currently blocks every `/library` and `/clients` page load

5. **Remove debug route** — `/api/debug/summarize/[id]`

6. **Multi-article LinkedIn post** — product wants 2-3 stories → 1 post. Needs UX design first

7. **Migrate content generation to a BusiBox agent** — same pattern as newsletter-analyst, gives frontier model quality and structured output validation

8. **Draft approval workflow** — add status field to generated content before any real client outreach

---

## Files to Be Aware Of (Stale / Legacy)

From `CLAUDE.md`:
- `proxy.ts` (root level) — orphaned middleware, not used. Delete.
- `test/dev-server-middleware.test.ts` — tests the orphaned proxy. Delete.
- `components/ConnectionStatus.tsx` — not imported anywhere. Delete.
- `components/NewsletterCard.tsx` — not imported anywhere. Delete.
- `app/(authenticated)/format/page.tsx` — orphaned page, format picker moved to Settings. Delete.
- `app/(authenticated)/demo/` and `app/api/demo/` — demo routes from template. Delete before production.

---

## Git State

| Repo | Branch | Last commit | Pushed |
|------|--------|-------------|--------|
| newsletter-digest | main | `0943561` — agent wiring + 6000 char limit | ✅ pushed |
| busibox | main | `828e4b53` — newsletter-analyst agent + litellm config | ❌ local only (needs jazzmind GitHub credentials) |
