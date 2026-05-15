# Newsletter Digest Production Readiness Roadmap

Last updated: May 15, 2026

This document captures:

- what is still not production ready
- what must be fixed before an internal rollout
- what must be fixed before a client-facing pilot
- the concrete task list for tomorrow

## Current State

Newsletter Digest is now beyond a UI prototype.

The app already has:

- Busibox auth and token exchange
- Microsoft OAuth mailbox connection
- newsletter sync and persistence
- stored summaries
- client profile CRUD
- persisted client relevance matches
- persisted content generation drafts
- a deployment-shaped Busibox manifest

The main remaining work is not "can the app run?" but "can it be trusted, scaled, and demoed safely?"

## Must Fix Before Internal Rollout

These are the highest-priority product and engineering gaps.

### 1. Make content generation server-trustworthy

Current issue:

- `POST /api/content/generate` accepts article and client payloads from the browser and uses them directly.

Why this matters:

- the server should not trust arbitrary client-provided article context for production workflows
- generated output can drift away from stored app data

Required fix:

- accept `articleId` and optional `clientId`
- load the stored article and stored client server-side
- generate only from canonical backend records

### 2. Make summarization reliability consistent

Current issue:

- sync falls back gracefully when summarization fails
- manual re-summarization still fails hard in some cases

Why this matters:

- users should not see different reliability depending on which button they used
- demo behavior becomes unpredictable

Required fix:

- align single-newsletter summarize behavior with sync behavior
- store summary provenance such as `ai`, `fallback`, `regenerated`
- store failure reason for debugging

### 3. Remove debug-only production surfaces

Current issue:

- `/api/debug/summarize/[id]` is still present

Why this matters:

- debug routes should not ship in a production-facing app unless explicitly protected by environment gating

Required fix:

- remove the route or gate it behind a non-production environment check

### 4. Stop doing write work on read paths

Current issue:

- `GET /api/client-relevance` recomputes and rewrites all client matches

Why this matters:

- read requests should not perform heavy persistence work
- scaling and latency get worse as newsletter volume grows

Required fix:

- move match refresh to:
  - newsletter sync
  - client create/update
  - or background refresh jobs

### 5. Replace heuristic-only article scoring with a more durable model

Current issue:

- category, importance, novelty, urgency, and parts of client relevance are still hardcoded heuristics

Why this matters:

- difficult to tune
- difficult to explain to operators
- difficult to personalize across users

Required fix:

- define a stored article-enrichment layer
- make scoring configurable
- separate deterministic scoring from optional LLM-assisted analysis

## Must Fix Before Client Pilot

These are not all immediate blockers for internal use, but they matter before any real client-facing workflow.

### 1. Add review and approval workflow

Missing pieces:

- draft status: `draft`, `approved`, `rejected`, `sent`
- owner and reviewer assignment
- approval timestamp and audit trail
- review queue and ready-to-send queue

### 2. Decide source of truth for client data

Open product question:

- are client records app-native
- or synced from a CRM such as HubSpot or Salesforce

This affects:

- edit permissions
- sync direction
- ownership mapping
- relationship stage accuracy

### 3. Finish ingest operations behind the polished UI

Still missing:

- sender/source document
- queue document
- filter rule persistence
- processing metrics from real backend state
- durable saved/bookmarked article state

### 4. Clarify summary quality model

Needed before external usage:

- show which summaries are real AI output vs fallback output
- allow rerun/regenerate
- improve noisy newsletter parsing so generic fallback summaries become rare

### 5. Strengthen route coverage and browser verification

Still worth adding:

- more route tests around clients CRUD
- tests for relevance cleanup after deletes
- browser-level verification for `/library`, `/clients`, `/generate`, `/settings`

## Can Wait Until Post-Pilot

These are good improvements but do not have to block near-term progress.

- CRM sync polish
- richer article bookmarking and collections
- tunable scoring controls in settings
- outreach send providers
- analytics dashboard for generated drafts and relevance performance
- richer sender rules and bulk operations

## Tomorrow Task List

These are the tasks already identified for tomorrow.

### Product / feature tasks

1. Email client to populate the whole form instead of manual typing

- allow users to choose an existing client record when generating email content
- prefill all relevant fields automatically
- reduce manual data entry during outreach drafting

2. Club 2-3 newsletter stories into one LinkedIn post

- current flow is effectively 1 article -> 1 post
- new flow should support selecting multiple related articles
- generate one coherent combined LinkedIn post

3. Add a dedicated email summarization / parsing agent

- current summarization path is generic and still inconsistent on noisy newsletters
- evaluate a dedicated email/newsletter parsing agent or a specialized multi-step summarization flow
- aim for more reliable extraction, cleaner grouping, and stronger conclusion quality

4. Rerun summaries and relevance score based on the user, not one shared default

- make summary and relevance behavior personalized
- support user-specific summary preferences, thresholds, scoring logic, and rerun controls
- avoid one-size-fits-all outputs across all users

5. Explore LinkedIn integration

- define whether this is:
  - content export only
  - copy-to-clipboard workflow
  - draft/save integration
  - direct publish flow
- clarify security and approval requirements before direct posting

## Recommended Additional Tasks For Tomorrow

These are the most practical next tasks to pair with the list above.

### A. Make content generation use backend records only

Why tomorrow:

- this is one of the clearest production-readiness gaps
- it will improve trust in email, LinkedIn, and thought-leadership outputs immediately

### B. Add summary provenance fields

Suggested fields:

- `summarySource`
- `summaryFailureReason`
- `generatedBy`
- `generatedAt`

Why tomorrow:

- lets the UI show `AI` vs `Fallback`
- helps debug quality issues quickly
- helps demos feel honest and controlled

### C. Remove or gate the debug summarization route

Why tomorrow:

- fast cleanup
- easy win before deeper product work

### D. Move client relevance refresh off the read path

Best first version:

- refresh affected client matches after client create/update
- refresh article matches after newsletter sync

Why tomorrow:

- reduces architecture debt before more client features land

### E. Define combined-post generation UX

Questions to answer:

- where does article multi-select live
- how many stories can be merged
- should order be user-controlled
- should the output be one post or multiple angle options

Why tomorrow:

- prevents building the backend before the workflow is clear

## Suggested Execution Order For Tomorrow

1. Lock the production-safety fixes:

- backend-trusted content generation
- debug route cleanup
- summary provenance

2. Improve summary quality:

- dedicated email/newsletter parsing path
- rerun controls

3. Improve editorial workflows:

- multi-article LinkedIn generation
- client autofill in email generation

4. Improve relevance architecture:

- move refresh off read path
- add user-specific rerun behavior

5. Explore optional integrations:

- LinkedIn
- CRM direction

## Good Demo-Safe Talking Point

If asked what remains before this becomes production-ready:

"The app architecture is real and the core flows are live, but we still need to tighten trust boundaries, improve summary reliability, formalize approval workflows, and complete a few backend pieces behind the ingest and client relevance experiences."
