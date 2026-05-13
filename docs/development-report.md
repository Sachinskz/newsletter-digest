# Newsletter Digest Development Report

Last updated: May 13, 2026

## Product Direction

Newsletter Digest is now moving from a simple mailbox summarizer into an AI analyst workspace. The app helps an operator ingest AI newsletters, extract high-signal stories, match those stories to clients, and generate useful business content from the selected article context.

The current UI direction follows the provided dark analyst reference:

- Compact left navigation
- Dense work surfaces instead of marketing sections
- Glass panels, small chips, score bars, status badges, and briefing-style cards
- First-screen utility rather than a landing page

## Current Navigation

The visible app navigation now contains:

- Dashboard
- Ingest Newsletter
- Article Library
- Client Relevance
- Content Generator
- Settings

The older `Newsletters`, `Format Choices`, and old-style `Settings` entries have been removed from the sidebar. Their underlying routes still exist as legacy/internal URLs, but the user-facing path is now the analyst-style navigation above.

## Implemented Pages

### Dashboard

The dashboard shows the current AI brief, top stories, quick actions, format status, and Microsoft connection state. It uses real stored newsletters and summaries when available. Before Microsoft OAuth is connected, it shows production-shaped empty states and preview content where appropriate.

### Ingest Newsletter

The ingest screen is frontend-ready and designed around the future Microsoft Graph ingestion workflow. It shows connection status, inbox queue, sender sources, processing metrics, and manual paste exploration. Backend ingestion items are still tracked in `docs/ingest-backend-todo.md`.

### Article Library

The article library is a searchable, filterable, sortable story workspace.

What works now:

- Search by title, summary, company, or topic
- Filter by category
- Sort by importance, novelty, or urgency
- Local saved-state toggle
- Article drawer with scores, topics, companies, and relevant clients
- Links into the Content Generator for LinkedIn and email drafts

Current data behavior:

- Uses real newsletters and summaries when available
- Falls back to sample AI stories while Microsoft sync is not connected
- Importance, novelty, urgency, category, company, and topic metadata are currently derived in frontend helper logic

### Client Relevance

The client page shows local client profiles and matched articles.

What works now:

- Add, edit, and remove local client profiles
- Match articles to clients using deterministic score logic
- Show match score, match reason, and top matched stories
- Route matched draft CTAs into the Content Generator

Current data behavior:

- Client profiles are local preview state
- Matching is deterministic and does not use an LLM
- A future backend pass should persist client profiles and optionally sync them from CRM

### Content Generator

The content generator is now both frontend-ready and backend-wired.

Supported output types:

- LinkedIn post
- Client email
- Thought leadership
- Newsletter paragraph
- Talking points
- Investor blurb

Supported tones:

- Analytical
- Executive
- Conversational
- Punchy
- Sober
- Visionary

What works now:

- Select an article
- Select output type
- Select tone or client recipient
- Generate via Busibox `agent-api`
- Validate structured model output
- Persist generated drafts to `data-api`
- Show recent generated drafts
- Copy generated content
- Deep link from Article Library and Client Relevance into the generator

## Backend Wiring

### Existing backend pieces

- Microsoft OAuth routes
- Microsoft connection status and disconnect
- Newsletter sync route
- Newsletter list/detail routes
- Individual summarization route
- Preferences route for summary format
- Authenticated Busibox token exchange
- Data-api document setup
- Agent-api summarization call

### New backend pieces

Added `newsletter-digest-generated-content` as a personal data-api document.

Added routes:

- `GET /api/content`
- `POST /api/content/generate`

`POST /api/content/generate` does the production work:

- Requires Busibox auth
- Exchanges token for `agent-api`
- Exchanges token for `data-api`
- Validates article, content type, tone, and client payloads
- Calls `${AGENT_API_URL}/runs/invoke`
- Uses a strict JSON response schema
- Parses and validates model output
- Stores the generated content in data-api
- Returns the persisted draft

## Where LLM Calls Help

LLM calls are used for:

- Newsletter summarization
- Content generation
- Client email drafting
- Thought leadership drafting
- Public post drafting
- Talking point synthesis
- Investor blurb phrasing

These tasks benefit from language judgment, synthesis, and tone control.

## Where LLM Calls Do Not Help

LLM calls are intentionally not used for:

- Filtering articles
- Sorting by score
- Matching query text
- Saving settings
- Checking Microsoft connection status
- Basic client profile editing
- Local UI state
- Validating payload shapes

These are deterministic product behaviors. Keeping them outside the model path makes the app faster, cheaper, easier to test, and easier to reason about.

## Data Documents

The app now ensures these personal documents:

- `newsletter-digest-connections`
- `newsletter-digest-subscriptions`
- `newsletter-digest-emails`
- `newsletter-digest-summaries`
- `newsletter-digest-preferences`
- `newsletter-digest-generated-content`

## Settings

Settings is now rebuilt in the same analyst UI as the rest of the app.

It includes:

- Microsoft 365 connection status
- Connect/reconnect action
- Disconnect action
- Connection metadata
- Token expiry metadata
- Summary format preference
- Format preview cards
- Security notes for AuthZ keystore and data-api storage

## Production Notes

Microsoft OAuth is still blocked on portal-owner setup:

- `MS_CLIENT_SECRET` must be provided securely
- `MS_REDIRECT_URI` must be registered in Azure
- Remote Busibox AuthZ/data-api/agent-api endpoints must be reachable

Once those are available, the manual end-to-end path should be:

1. Open the app through Busibox/local dev.
2. Connect Microsoft 365.
3. Sync newsletters.
4. Confirm Article Library fills with real stories.
5. Generate a newsletter summary.
6. Open Content Generator from a story.
7. Generate and copy a draft.
8. Refresh and confirm the draft appears in Recent Drafts.

## Remaining Backend Work

Tracked in `docs/ingest-backend-todo.md`.

Important remaining items:

- Persist saved/bookmarked article state
- Persist real client profiles
- Replace frontend-derived article scores with backend enrichment
- Add approval states for generated drafts
- Add CRM/contact integration if client relevance becomes a real workflow
- Add send workflow only after approval and compliance requirements are agreed

## Verification

Run:

```bash
npm test
npm run build
```

The current implementation includes tests for:

- Summary format behavior
- Preferences API
- Microsoft OAuth callback behavior
- Newsletter sync and summarization route behavior
- Content generation prompt and output validation
- Content generation API route behavior
