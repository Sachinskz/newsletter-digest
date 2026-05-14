# CLAUDE.md

This repository is the Newsletter Digest Busibox app. Treat it as an app repo, not the generic template.

## Purpose

Newsletter Digest connects a user's Microsoft 365 mailbox, syncs recent newsletter-style emails, stores normalized content through Busibox `data-api`, summarizes individual newsletters, and generates business content (LinkedIn posts, client emails, thought leadership) through `agent-api`.

The UI is a dark AI analyst workspace with compact sidebar navigation, glass-panel work surfaces, and score-driven article cards.

## Navigation (current)

| Page | Route | Purpose |
|---|---|---|
| Dashboard | `/` | Executive brief, top stories, quick actions |
| Ingest Newsletter | `/ingest` | Microsoft 365 connection, sync, inbox metrics |
| Article Library | `/library` | Searchable/filterable scored article grid |
| Client Relevance | `/clients` | Client profiles + deterministic article matching |
| Content Generator | `/generate` | LinkedIn/email/thought-piece generation from articles |
| Settings | `/settings` | Microsoft connection, summary format preference |

Legacy routes (`/newsletters`, `/newsletters/[id]`, `/format`) still exist but are not in the sidebar navigation.

## Development Rules

- Use Busibox SSO/authz for every app API route.
- Use `requireAuthWithTokenExchange` before calling `data-api` or `agent-api`.
- Never store Microsoft access or refresh tokens in plaintext.
- Encrypt token JSON through AuthZ keystore with a deterministic connection `file_id` and the current Busibox `user_id`.
- Keep user data in personal documents unless product requirements explicitly change visibility.
- Do not add direct database access, Prisma, or app-owned external storage.
- Keep sync bounded for the MVP: latest 50 inbox messages only.
- Keep batch summarization, scheduled sync, and advanced pagination deferred until the first end-to-end test passes.
- Keep Microsoft OAuth as the production path; do not add paste/mock ingest unless explicitly requested.
- Deterministic operations (filtering, sorting, scoring, matching) stay client-side; LLM calls are only for synthesis, tone control, and language judgment.

## Data Documents (6)

| Document | Purpose |
|---|---|
| `newsletter-digest-connections` | Microsoft account metadata, encrypted token reference, sync status |
| `newsletter-digest-subscriptions` | Discovered sender metadata |
| `newsletter-digest-emails` | Synced newsletter content (plain text, sender, subject, dates) |
| `newsletter-digest-summaries` | Structured AI summaries (title, tldr, keyPoints, actionItems, topics) |
| `newsletter-digest-preferences` | User's preferred summary format |
| `newsletter-digest-generated-content` | AI-generated drafts (LinkedIn, email, thought piece, etc.) |

All documents are personal visibility by default.

## Important Files

### Core pipeline
- `lib/data-api-client.ts`: All 6 document schemas and CRUD helpers.
- `lib/types.ts`: All TypeScript interfaces.
- `lib/microsoft-oauth.ts`: PKCE, authorize URL, token exchange, refresh.
- `lib/microsoft-graph.ts`: Graph profile/message fetching, refresh-before-use.
- `lib/keystore.ts`: AuthZ keystore encryption/decryption bridge.
- `lib/newsletter-detection.ts`: Newsletter heuristics (List-Unsubscribe, sender patterns).
- `lib/html-to-text.ts`: Safe HTML/plain text normalization.
- `lib/summarization.ts`: Summary format options, strict schema, prompt builder.

### Content generation
- `lib/content-generation.ts`: Content kinds/tones, strict schema, prompt builder.
- `lib/editorial-intelligence.ts`: Article scoring, category derivation, client matching (deterministic).

### API routes
- `app/api/oauth/*`: Microsoft connection lifecycle (authorize, callback, status, disconnect).
- `app/api/newsletters/*`: Sync, list, detail, summarize.
- `app/api/content/*`: List drafts, generate content.
- `app/api/preferences`: Summary format preference (GET/PUT).
- `app/api/setup`: Bootstrap all 6 data documents.

### UI
- `components/Workspace.tsx`: Layout shell, sidebar, nav, glass panels.
- `app/(authenticated)/*`: All 6 main pages + legacy routes.

## Stale files to clean up

- `proxy.ts` (root level): Orphaned middleware from earlier architecture. Superseded by `dev-server/proxy.ts`.
- `test/dev-server-middleware.test.ts`: Tests the orphaned root proxy.ts.
- `components/ConnectionStatus.tsx`: Not imported by any page.
- `components/NewsletterCard.tsx`: Not imported by any page.
- `app/(authenticated)/format/page.tsx`: Orphaned page, not linked anywhere. Format picker is in Settings.

## Verification

Run these before handing off changes:

```bash
npm test
npm run build
```

Real OAuth testing also requires:

- `MS_CLIENT_SECRET` from Azure.
- `MS_REDIRECT_URI` registered in Azure.
- Reachable Busibox `data-api`, `agent-api`, and AuthZ services.
