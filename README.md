# Newsletter Digest

Newsletter Digest is a Busibox app MVP that connects a user's Microsoft 365 mailbox, detects recent newsletter-style emails, stores the useful content in personal Busibox `data-api` documents, and generates structured summaries through `agent-api`.

## What This MVP Proves

- Microsoft OAuth can be added to a Busibox app without exposing tokens to the browser.
- OAuth token JSON can be encrypted through AuthZ keystore using user-owned key isolation.
- Recent mailbox sync can fetch a bounded window of messages from Microsoft Graph.
- Newsletter detection can filter normal personal email out of the first sync pass.
- Stored newsletter records can be summarized on demand with Busibox agent-api.
- First-run setup can capture the user's preferred briefing format before sync is available.

## App Shape

- App id: `newsletter-digest`
- Default path: `/newsletter-digest`
- Default dev port: `3002`
- Icon: `Newspaper`
- Main pages: `Dashboard`, `Newsletters`, `Format Choices`, `Settings`

## Required Environment Variables

```bash
MS_CLIENT_ID=<your-azure-app-client-id>
MS_CLIENT_SECRET=<from Azure app registration>
MS_REDIRECT_URI=http://localhost:3002/api/oauth/callback
```

For deployment behind the Busibox app path, register the deployed callback URI in Azure, for example:

```bash
MS_REDIRECT_URI=https://<busibox-domain>/newsletter-digest/api/oauth/callback
```

The app also uses the standard Busibox template environment for SSO, `data-api`, `agent-api`, and AuthZ token exchange.

## Data Documents

- `newsletter-digest-connections`: Microsoft account metadata, encrypted token reference, expiry, sync status.
- `newsletter-digest-subscriptions`: discovered sender metadata for future subscription controls.
- `newsletter-digest-emails`: Graph message id, sender, subject, received date, plain text body, summary state.
- `newsletter-digest-summaries`: strict structured AI output for each summarized newsletter.
- `newsletter-digest-preferences`: selected summary format for first-run setup and future summaries.

All documents are personal by default.

## Core Flow

1. On first open, choose a preferred summary format: Bullet Points, Executive Summary, Key Insights, or Full Digest.
2. Open Settings and connect Microsoft 365 when the portal owner has registered the OAuth redirect URI and secret.
3. OAuth callback exchanges the code for tokens, fetches `/me`, encrypts token JSON through AuthZ keystore, and stores only encrypted metadata.
4. Click Sync from Dashboard or Newsletters.
5. Sync refreshes tokens if needed, scans the latest 50 inbox messages, detects newsletters, normalizes HTML to plain text, dedupes by Graph message id, and stores new records.
6. Open a newsletter and generate a summary using the saved format preference.
7. The app invokes `agent-api` with the `record-extractor` schema and persists the structured summary.

## Verification

```bash
npm test
npm run build
```

Manual end-to-end testing needs a registered Microsoft redirect URI, `MS_CLIENT_SECRET`, and reachable Busibox remote services.
