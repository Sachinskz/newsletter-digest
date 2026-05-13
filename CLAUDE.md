# CLAUDE.md

This repository is the Newsletter Digest Busibox app. Treat it as an app repo, not the generic template.

## Purpose

Newsletter Digest connects a user's Microsoft 365 mailbox, syncs recent newsletter-style emails, stores normalized content through Busibox `data-api`, and summarizes individual newsletters through `agent-api`.
The UI direction is a dark AI analyst workspace with first-run format selection.

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

## Important Files

- `busibox.json`: app manifest for `newsletter-digest`.
- `lib/data-api-client.ts`: document schemas and storage helpers.
- `lib/summarization.ts`: summary format options, strict summary schema, and prompt builder.
- `lib/microsoft-oauth.ts`: PKCE, authorize URL, token exchange, refresh exchange.
- `lib/microsoft-graph.ts`: Graph profile/message fetching and refresh-before-use helper.
- `lib/keystore.ts`: AuthZ keystore encryption/decryption bridge.
- `lib/newsletter-detection.ts`: newsletter heuristics.
- `lib/html-to-text.ts`: safe HTML/plain text normalization.
- `app/api/oauth/*`: Microsoft connection lifecycle.
- `app/api/preferences`: first-run summary format preference.
- `app/api/newsletters/*`: sync, list, detail, summarize.
- `app/(authenticated)/*`: Dashboard, Newsletters, Format Choices, Settings UI.

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
